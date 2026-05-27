"use server";

import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { generateObject } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { scoreResumeText, type AtsScoreResult } from "@/lib/ats-scoring";
import { extractResume } from "@/lib/ats/extract";
import { prisma } from "@/lib/prisma";
import { assertFileSize, detectFileMime, resumeMimeTypes } from "@/lib/validators";
import { geminiModel } from "@/lib/ai";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/en/auth/sign-in");
  }

  return session.user;
}

const atsScoreSchema = z.object({
  extractedText: z.string().describe("A clean text representation of the resume extracted from the file"),
  overall: z.number().min(0).max(100),
  format: z.number().min(0).max(25),
  content: z.number().min(0).max(25),
  keywords: z.number().min(0).max(25),
  length: z.number().min(0).max(25),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
  jdKeywordMatchPct: z.number().min(0).max(100).optional(),
  jdTopKeywords: z.array(z.string()).optional(),
  matchingKeywords: z.array(z.string()).optional(),
  missingKeywords: z.array(z.string()).optional(),

  // Parity additions
  jdAnalysis: z.object({
    hardSkills: z.array(z.string()),
    softSkills: z.array(z.string()),
    certifications: z.array(z.string()),
    tools: z.array(z.string()),
    yearsOfExperience: z.number(),
    seniority: z.string(),
    educationLevel: z.string(),
  }).optional(),

  atsSimulator: z.object({
    contact: z.object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      linkedin: z.string().optional(),
      parsedOk: z.boolean(),
      issues: z.array(z.string()),
    }),
    summary: z.object({
      parsedText: z.string().optional(),
      parsedOk: z.boolean(),
    }),
    experience: z.array(z.object({
      role: z.string().optional(),
      company: z.string().optional(),
      duration: z.string().optional(),
      description: z.string().optional(),
      parsedOk: z.boolean(),
    })),
    education: z.array(z.object({
      degree: z.string().optional(),
      institution: z.string().optional(),
      year: z.string().optional(),
      parsedOk: z.boolean(),
    })),
    skills: z.array(z.object({
      name: z.string(),
      type: z.enum(["hard", "soft"]),
    })),
    certifications: z.array(z.string()),
    projects: z.array(z.string()),
    missingRequiredSections: z.array(z.string()),
  }).optional(),

  bulletAnalysis: z.object({
    bullets: z.array(z.object({
      text: z.string(),
      section: z.string(),
      actionVerb: z.boolean(),
      quantified: z.boolean(),
      xyzFormat: z.boolean(),
      pronounUsed: z.boolean(),
      tenseConsistency: z.enum(["past", "present", "mixed", "unknown"]),
      lengthOk: z.boolean(),
      suggestions: z.array(z.string()),
    })),
    impactScore: z.number().min(0).max(100),
  }).optional(),

  formattingHazards: z.object({
    hasMultiColumnCrossover: z.boolean(),
    hasTables: z.boolean(),
    imageCount: z.number(),
    hasHeaderText: z.boolean(),
    hasEmojis: z.boolean(),
    nonStandardFonts: z.boolean(),
    issues: z.array(z.string()),
  }).optional(),

  missingKeywordsWithHints: z.array(z.object({
    keyword: z.string(),
    type: z.enum(["hard", "soft", "cert", "tool"]),
    hint: z.string(),
  })).optional(),

  clicheBuzzwords: z.object({
    found: z.array(z.string()),
    scoreDeduction: z.number(),
  }).optional(),

  readability: z.object({
    fleschKincaidGrade: z.number(),
    label: z.string(),
  }).optional(),

  sriLankaContext: z.object({
    recognizedCompanies: z.array(z.string()),
    recognizedUniversities: z.array(z.string()),
    recognizedCerts: z.array(z.string()),
    hasNicWarning: z.boolean(),
    phoneNormalized: z.boolean(),
    isBilingual: z.boolean(),
    languageHints: z.array(z.string()),
    tips: z.array(z.string()),
  }).optional(),
});

export async function scoreAtsResumeAction(formData: FormData): Promise<AtsScoreResult> {
  const user = await requireUser();
  const pastedText = formValue(formData, "resumeText");
  const jobDescription = formValue(formData, "jobDescription");
  const uploaded = formData.get("resumeFile");
  let resumeText = pastedText;
  let filename = "Pasted resume text";
  let fileSize = Buffer.byteLength(pastedText);
  let fileType = "text";
  let buffer: Buffer | null = null;

  if (uploaded instanceof File && uploaded.size > 0) {
    buffer = Buffer.from(await uploaded.arrayBuffer());
    assertFileSize(uploaded.size, 5 * 1024 * 1024);
    const detectedMime = await detectFileMime(buffer);
    const browserMime = uploaded.type || detectedMime;

    if (!resumeMimeTypes.has(browserMime) && browserMime !== "text/plain" && detectedMime !== "application/octet-stream") {
      throw new Error("Unsupported resume file type");
    }

    filename = uploaded.name;
    fileSize = uploaded.size;
    fileType = uploaded.name.split(".").pop()?.toLowerCase() ?? "file";
    if (!resumeText.trim()) {
      // Real PDF / DOCX / plain-text extraction via unpdf + mammoth.
      // We refuse to silently fall back to the lossy buffer-to-utf8 hack —
      // that produces garbage text that the scorer treats as the user's
      // real resume and assigns confident-but-wrong scores. Better to
      // surface a clear error so the user re-exports their file.
      try {
        const extracted = await extractResume(buffer, {
          mime: detectedMime || browserMime,
          filename: uploaded.name,
        });
        resumeText = extracted.text.trim();
      } catch (extractError) {
        console.error("[ats] structured extraction failed:", extractError);
        throw new Error(
          "We couldn't read text from your file. Please re-export it as a PDF or DOCX (avoid scanned PDFs), or paste the text directly.",
        );
      }
      if (!resumeText) {
        throw new Error(
          "Your file parsed to zero readable text. If it's a scanned PDF, please OCR it first or paste the resume text directly.",
        );
      }
    }
  }

  let result: AtsScoreResult;

  try {
    const isPdf = fileType === "pdf";
    const geminiContent: Array<
      | { type: "text"; text: string }
      | { type: "file"; data: Buffer; mediaType: string }
    > = [
      {
        type: "text" as const,
        text: `You are an expert ATS (Applicant Tracking System) parser and resume reviewer, benchmarked against Jobscan and Resume Worded.
Analyze the provided resume against the following job description.

Job Description:
${jobDescription || "Not provided (perform a general resume review)"}

Evaluation Instructions:
1. Extract the clean text content from the resume.
2. Evaluate and score the resume out of 100, broken down into:
   - Format (max 25): Readability, sections present, layout issues, unescaped characters.
   - Content (max 25): Quality of work description, quantifiable impact (numbers/percentages), use of active verbs, no pronouns.
   - Keywords (max 25): Alignment with the job description. Weight hard skills 3x and soft skills 1x.
   - Length (max 25): Words count check (ideal is 400-800 words).
3. ATS Parser Simulator: Extract candidate info (name, email, phone, location, linkedin, experience, education, skills, certs) as seen by a parser.
4. Section Detection: Check for required sections (Experience, Education, Skills, Contact). Flag missing ones.
5. Bullet Audit: Perform sentence-by-sentence checks on experience bullets for action verbs, numbers (quantifiers), XYZ format ("Accomplished X by doing Y resulting in Z"), and pronouns. Compute a roll-up bullet impact score.
6. Formatting Hazards: Detect column layouts, tables, emojis, image placeholders, headers/footers, and non-standard fonts.
7. Sri Lanka Context: Detect Sri Lankan companies (Dialog, WSO2, MAS, Brandix, JKH, IFS, etc.), Sri Lankan universities (Moratuwa, UCSC, Colombo, SLIIT, IIT, Curtin Lanka, etc.), CA/CIMA/ACCA/SLIM certifications, phone number validation (07... or +947...), and NIC (National Identity Card) numbers (warning: do not share NIC!). Check for Sinhala/Tamil bilingual elements.
8. Missing Keywords: List missing keywords with hints on where to place them.
9. Cliche buzzwords: Identify buzzwords like "hardworking", "team player", "synergy" and deduct points.
10. Readability: Compute the Flesch-Kincaid reading grade level.
`
      }
    ];

    if (buffer && isPdf) {
      geminiContent.push({
        type: "file" as const,
        data: buffer,
        mediaType: "application/pdf"
      });
    } else if (resumeText.trim()) {
      geminiContent.push({
        type: "text" as const,
        text: `Resume Text:\n${resumeText}`
      });
    } else {
      throw new Error("No resume content provided");
    }

    const response = await generateObject({
      model: geminiModel,
      schema: atsScoreSchema,
      messages: [
        {
          role: "user",
          content: geminiContent
        }
      ]
    });

    const geminiResult = response.object;
    if (geminiResult.extractedText && !resumeText.trim()) {
      resumeText = geminiResult.extractedText;
    }

    const breakdown = {
      format: { score: geminiResult.format, max: 25 as const },
      content: { score: geminiResult.content, max: 25 as const },
      keywords: { score: geminiResult.keywords, max: 25 as const },
      length: { score: geminiResult.length, max: 25 as const },
    };

    result = {
      overall: geminiResult.overall,
      format: geminiResult.format,
      content: geminiResult.content,
      keywords: geminiResult.keywords,
      length: geminiResult.length,
      issues: geminiResult.issues,
      suggestions: geminiResult.suggestions,
      breakdown,
      jdKeywordMatchPct: geminiResult.jdKeywordMatchPct,
      jdTopKeywords: geminiResult.jdTopKeywords,
      matchingKeywords: geminiResult.matchingKeywords,
      missingKeywords: geminiResult.missingKeywords,
      
      // Parity components
      atsSimulator: geminiResult.atsSimulator,
      bulletAnalysis: geminiResult.bulletAnalysis,
      formattingHazards: geminiResult.formattingHazards,
      missingKeywordsWithHints: geminiResult.missingKeywordsWithHints,
      clicheBuzzwords: geminiResult.clicheBuzzwords,
      readability: geminiResult.readability,
      sriLankaContext: geminiResult.sriLankaContext,
    };
  } catch (error) {
    console.error("Gemini ATS check failed, falling back to local scoring:", error);
    result = scoreResumeText(resumeText, jobDescription);
  }

  const cvDocument = await prisma.cVDocument.create({
    data: {
      userId: user.id,
      filePath: filename,
      filename,
      fileType,
      fileSize,
      extractedText: resumeText || "No text extracted",
    },
  });

  const checkResult = await prisma.aTSCheckResult.create({
    data: {
      cvDocumentId: cvDocument.id,
      overallScore: result.overall,
      formatScore: result.format,
      contentScore: result.content,
      keywordsScore: result.keywords,
      lengthScore: result.length,
      jdKeywordMatchPct: result.jdKeywordMatchPct ?? null,
      jdTopKeywords: (result.jdTopKeywords ?? []) as Prisma.InputJsonValue,
      scores: {
        breakdown: result.breakdown,
        matchingKeywords: result.matchingKeywords ?? [],
        missingKeywords: result.missingKeywords ?? [],
        atsSimulator: result.atsSimulator ?? null,
        bulletAnalysis: result.bulletAnalysis ?? null,
        formattingHazards: result.formattingHazards ?? null,
        missingKeywordsWithHints: result.missingKeywordsWithHints ?? [],
        clicheBuzzwords: result.clicheBuzzwords ?? null,
        readability: result.readability ?? null,
        sriLankaContext: result.sriLankaContext ?? null,
      } as unknown as Prisma.InputJsonValue,
      issues: result.issues as Prisma.InputJsonValue,
      suggestions: result.suggestions as Prisma.InputJsonValue,
    },
  });

  result.id = checkResult.id;
  return result;
}
