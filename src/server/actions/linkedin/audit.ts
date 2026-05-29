"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { geminiModel } from "@/lib/ai";
import { linkedInAuditResultSchema, type LinkedInAuditResult } from "@/lib/linkedin-audit";
import { buildLinkedInAudit } from "@/lib/linkedin-optimization";
import { prisma } from "@/lib/prisma";
import { generateObject, generateText } from "ai";
import { buildLinkedInAuditPrompt, buildLinkedInOptimizeSectionPrompt, buildLinkedInRewritePrompt } from "./audit-prompts";

const auditFormSchema = z.object({
  targetRole: z.string().trim().min(2).max(255),
  profileText: z.string().trim().max(15000).default(""),
  audienceMode: z.enum(["local", "global"]).default("global"),
  hasPhoto: z.preprocess((val) => val === "true", z.boolean()).default(false),
  hasBanner: z.preprocess((val) => val === "true", z.boolean()).default(false),
  vanityUrl: z.string().trim().default(""),
  recsGiven: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  recsReceived: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  featuredPopulated: z.preprocess((val) => val === "true", z.boolean()).default(false),
  complianceMode: z.preprocess((val) => val === "true", z.boolean()).default(false),
  jdText: z.string().trim().default(""),
  connections: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  profileUrl: z.string().trim().default(""),
  hasOpenToWork: z.preprocess((val) => val === "true", z.boolean()).default(false),
  hasOpenToServices: z.preprocess((val) => val === "true", z.boolean()).default(false),
  lastPostDate: z.string().trim().default(""),
  postsPerWeek: z.preprocess((val) => Number(val) || 0, z.number()).default(0),
  avgEngagement: z.preprocess((val) => Number(val) || 0, z.number()).default(0),
  hashtags: z.string().trim().default(""),
  topEndorsedSkills: z.string().trim().default(""),
  regulatedIndustry: z.preprocess((val) => val === "true", z.boolean()).default(false),
  diasporaMode: z.preprocess((val) => val === "true", z.boolean()).default(false),
});

const rewriteSchema = z.object({
  sectionType: z.string().trim().min(2).max(100),
  tone: z.enum(["STANDARD", "PUNCHY", "LEADERSHIP"]).default("STANDARD"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireUser(locale: Locale) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  return session.user;
}

// Removed legacy fallbackLinkedInAudit; using buildLinkedInAudit directly now.

export async function startLinkedInAuditAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const uploaded = formData.get("profileFile");
  let profileText = formValue(formData, "profileText");
  let filename = "";
  let mimeType = "";
  let fileSize = 0;

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > 10 * 1024 * 1024) {
      throw new Error("File too large");
    }
    const buffer = Buffer.from(await uploaded.arrayBuffer());
    filename = uploaded.name;
    mimeType = uploaded.type || "application/octet-stream";
    fileSize = uploaded.size;
    if (!profileText.trim()) {
      profileText = buffer.toString("utf8").replace(/[^\x09\x0a\x0d\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  const uploadedPhoto = formData.get("photoFile");
  let photoAnalysisFeedback = "No photo provided for analysis.";
  let photoScore = 0;
  if (uploadedPhoto instanceof File && uploadedPhoto.size > 0 && uploadedPhoto.type.startsWith("image/")) {
    const photoBuffer = Buffer.from(await uploadedPhoto.arrayBuffer());
    const photoPrompt = `You are a Professional LinkedIn Recruiter. 
Analyze the provided profile photo. Does it look professional? Is the lighting good? Is the background clean? Does the person look approachable?
Give a score from 0 to 10 and 2-3 specific feedback points.
Format as JSON: { "score": 8, "feedback": ["Great lighting", "Background is a bit cluttered"] }`;
    
    try {
      const photoRes = await generateObject({
        model: geminiModel,
        schema: z.object({ score: z.number(), feedback: z.array(z.string()) }),
        messages: [
          {
            role: "user",
            content: [
              { type: "text" as const, text: photoPrompt },
              { type: "file" as const, data: photoBuffer, mediaType: uploadedPhoto.type }
            ]
          }
        ]
      });
      photoScore = photoRes.object.score;
      photoAnalysisFeedback = JSON.stringify(photoRes.object.feedback);
    } catch (err) {
      console.error("Photo analysis failed", err);
    }
  }

  const parsed = auditFormSchema.parse({
    targetRole: formValue(formData, "targetRole"),
    profileText,
    audienceMode: formValue(formData, "audienceMode") || "global",
    hasPhoto: formValue(formData, "hasPhoto") || "false",
    hasBanner: formValue(formData, "hasBanner") || "false",
    vanityUrl: formValue(formData, "vanityUrl"),
    recsGiven: formValue(formData, "recsGiven"),
    recsReceived: formValue(formData, "recsReceived"),
    featuredPopulated: formValue(formData, "featuredPopulated") || "false",
    complianceMode: formValue(formData, "complianceMode") || "false",
    jdText: formValue(formData, "jdText"),
    connections: formValue(formData, "connections"),
    profileUrl: formValue(formData, "profileUrl"),
    hasOpenToWork: formValue(formData, "hasOpenToWork") || "false",
    hasOpenToServices: formValue(formData, "hasOpenToServices") || "false",
    lastPostDate: formValue(formData, "lastPostDate"),
    postsPerWeek: formValue(formData, "postsPerWeek"),
    avgEngagement: formValue(formData, "avgEngagement"),
    hashtags: formValue(formData, "hashtags"),
    topEndorsedSkills: formValue(formData, "topEndorsedSkills"),
    regulatedIndustry: formValue(formData, "regulatedIndustry") || "false",
    diasporaMode: formValue(formData, "diasporaMode") || "false",
  });

  const deterministicResult = buildLinkedInAudit({
    profileText: parsed.profileText,
    targetRole: parsed.targetRole,
    audienceMode: parsed.audienceMode,
    hasPhoto: parsed.hasPhoto,
    hasBanner: parsed.hasBanner,
    vanityUrl: parsed.vanityUrl,
    profileUrl: parsed.profileUrl,
    recsGiven: parsed.recsGiven,
    recsReceived: parsed.recsReceived,
    featuredPopulated: parsed.featuredPopulated,
    complianceMode: parsed.complianceMode,
    regulatedIndustry: parsed.regulatedIndustry,
    diasporaMode: parsed.diasporaMode,
    hasOpenToWork: parsed.hasOpenToWork,
    hasOpenToServices: parsed.hasOpenToServices,
    jdText: parsed.jdText,
    connections: parsed.connections,
    lastPostDate: parsed.lastPostDate,
    postsPerWeek: parsed.postsPerWeek,
    avgEngagement: parsed.avgEngagement,
    hashtags: splitCsv(parsed.hashtags),
    topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
  });

  const audit = await prisma.linkedInAudit.create({
    data: {
      userId: user.id,
      targetRole: parsed.targetRole,
      inputText: parsed.profileText,
      status: "processing",
    },
  });

  if (filename) {
    await prisma.linkedInInputFile.create({
      data: {
        auditId: audit.id,
        filePath: `linkedin/${audit.id}/${filename}`,
        filename,
        mimeType,
        fileSize,
      },
    });
  }

  await prisma.linkedInExtractedProfile.create({
    data: {
      auditId: audit.id,
      text: parsed.profileText,
      dataJson: {
        source: filename ? "file" : "text",
        audienceMode: parsed.audienceMode,
        hasPhoto: parsed.hasPhoto,
        hasBanner: parsed.hasBanner,
        vanityUrl: parsed.vanityUrl,
        recsGiven: parsed.recsGiven,
        recsReceived: parsed.recsReceived,
        featuredPopulated: parsed.featuredPopulated,
        complianceMode: parsed.complianceMode,
        jdText: parsed.jdText,
        connections: parsed.connections,
        profileUrl: parsed.profileUrl,
        hasOpenToWork: parsed.hasOpenToWork,
        hasOpenToServices: parsed.hasOpenToServices,
        lastPostDate: parsed.lastPostDate,
        postsPerWeek: parsed.postsPerWeek,
        avgEngagement: parsed.avgEngagement,
        hashtags: splitCsv(parsed.hashtags),
        topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
        regulatedIndustry: parsed.regulatedIndustry,
        diasporaMode: parsed.diasporaMode,
      },
    },
  });

  const prompt = buildLinkedInAuditPrompt(parsed, photoScore, photoAnalysisFeedback);

  let result = deterministicResult;
  try {
    const aiResponse = await generateObject({
      model: geminiModel,
      schema: linkedInAuditResultSchema,
      prompt,
    });
    result = mergeLinkedInAuditResults(deterministicResult, aiResponse.object);
  } catch (error) {
    console.error("Gemini full LinkedIn audit failed, using fallback:", error);
    result = deterministicResult;
  }

  await prisma.linkedInAuditResult.create({
    data: {
      auditId: audit.id,
      scoreBreakdown: result.score_breakdown,
      missingKeywords: result.missing_keywords,
      sectionScores: result.section_scores,
      checklistItems: result.checklist_items,
      summaryFeedback: result.summary_feedback,
    },
  });

  // We store the rich audit items in dataJson of ExtractedProfile
  await prisma.linkedInExtractedProfile.update({
    where: { auditId: audit.id },
    data: {
      dataJson: {
        source: filename ? "file" : "text",
        audienceMode: parsed.audienceMode,
        hasPhoto: parsed.hasPhoto,
        hasBanner: parsed.hasBanner,
        vanityUrl: parsed.vanityUrl,
        recsGiven: parsed.recsGiven,
        recsReceived: parsed.recsReceived,
        featuredPopulated: parsed.featuredPopulated,
        complianceMode: parsed.complianceMode,
        jdText: parsed.jdText,
        connections: parsed.connections,
        profileUrl: parsed.profileUrl,
        hasOpenToWork: parsed.hasOpenToWork,
        hasOpenToServices: parsed.hasOpenToServices,
        lastPostDate: parsed.lastPostDate,
        postsPerWeek: parsed.postsPerWeek,
        avgEngagement: parsed.avgEngagement,
        hashtags: splitCsv(parsed.hashtags),
        topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
        regulatedIndustry: parsed.regulatedIndustry,
        diasporaMode: parsed.diasporaMode,
        headline_analysis: result.headline_analysis,
        about_analysis: result.about_analysis,
        rec_endorsement_analysis: result.rec_endorsement_analysis,
        featured_audit: result.featured_audit,
        open_to_work_audit: result.open_to_work_audit,
        sri_lanka_moat: result.sri_lanka_moat,
        profile_media_audit: result.profile_media_audit,
        jd_keyword_analysis: result.jd_keyword_analysis,
        activity_analysis: result.activity_analysis,
        skills_optimizer: result.skills_optimizer,
        benchmark: result.benchmark,
      }
    }
  });

  await prisma.linkedInAudit.update({
    where: { id: audit.id },
    data: { status: "done" },
  });

  redirect(`/${locale}/linkedin/${audit.id}`);
}

export async function requestLinkedInRewriteAction(locale: Locale, auditId: string, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = rewriteSchema.parse({
    sectionType: formValue(formData, "sectionType"),
    tone: formValue(formData, "tone") || "STANDARD",
  });
  const audit = await prisma.linkedInAudit.findFirst({
    where: { id: auditId, userId: user.id },
  });
  if (!audit) {
    redirect(`/${locale}/linkedin`);
  }

  const prompt = buildLinkedInRewritePrompt(parsed.sectionType, parsed.tone, audit.inputText, audit.targetRole);

  let rewritten = "Rewrite unavailable. Add more profile text and try again.";
  try {
    const { text } = await generateText({
      model: geminiModel,
      prompt,
    });
    rewritten = text.trim();
  } catch (error) {
    console.error("Rewrite generation failed:", error);
    rewritten = `Optimized ${parsed.sectionType}: ${audit.targetRole} professional with proven experience, measurable outcomes, and a clear focus on practical business impact.`;
  }

  await prisma.linkedInRewriteSuggestion.create({
    data: {
      auditId: audit.id,
      sectionType: parsed.sectionType,
      original: audit.inputText.slice(0, 2000),
      rewritten,
      tone: parsed.tone,
    },
  });

  redirect(`/${locale}/linkedin/${audit.id}?rewritten=1`);
}

const optimizeSectionSchema = z.object({
  sectionType: z.string(),
  currentText: z.string(),
  targetRole: z.string(),
  tone: z.enum(["STANDARD", "PUNCHY", "LEADERSHIP"]).default("STANDARD")
});

export async function optimizeLinkedInSectionAction(input: z.infer<typeof optimizeSectionSchema>) {
  const parsed = optimizeSectionSchema.parse(input);

  const prompt = buildLinkedInOptimizeSectionPrompt(parsed.sectionType, parsed.currentText, parsed.targetRole, parsed.tone);

  try {
    const { text } = await generateText({
      model: geminiModel,
      prompt,
    });
    return { optimizedText: text.trim() };
  } catch (error) {
    console.error("LinkedIn section optimization failed:", error);
    return { 
      optimizedText: `Optimized ${parsed.sectionType}: Experienced ${parsed.targetRole} professional with a proven track record of delivering measurable outcomes, applying industry best practices, and driving operational excellence.` 
    };
  }
}

function splitCsv(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeLinkedInAuditResults(base: LinkedInAuditResult, ai: LinkedInAuditResult): LinkedInAuditResult {
  return linkedInAuditResultSchema.parse({
    ...ai,
    missing_keywords: ai.missing_keywords.length ? ai.missing_keywords : base.missing_keywords,
    checklist_items: ai.checklist_items.length ? ai.checklist_items : base.checklist_items,
    headline_analysis: { ...base.headline_analysis, ...ai.headline_analysis },
    about_analysis: { ...base.about_analysis, ...ai.about_analysis },
    rec_endorsement_analysis: { ...base.rec_endorsement_analysis, ...ai.rec_endorsement_analysis },
    featured_audit: { ...base.featured_audit, ...ai.featured_audit },
    open_to_work_audit: { ...base.open_to_work_audit, ...ai.open_to_work_audit },
    profile_media_audit: base.profile_media_audit,
    jd_keyword_analysis: base.jd_keyword_analysis,
    activity_analysis: base.activity_analysis,
    skills_optimizer: base.skills_optimizer,
    benchmark: base.benchmark,
    sri_lanka_moat: { ...base.sri_lanka_moat, ...ai.sri_lanka_moat },
  });
}

const parsedLinkedInProfileSchema = z.object({
  name: z.string().default("Chanuka Jeewantha"),
  headline: z.string().default("Software Engineer"),
  about: z.string().default("Experienced engineer passionate about web technologies."),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    duration: z.string(),
    description: z.string()
  })).default([]),
  skills: z.array(z.string()).default([])
});

export async function parseLinkedInPdfAction(formData: FormData) {
  const uploaded = formData.get("profileFile");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    throw new Error("No file uploaded");
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());
  const prompt = `You are an expert LinkedIn profile parser. 
Extract the profile information from the uploaded PDF resume/profile export.
Ensure you capture their name, headline, about/summary, experience list, and skills.`;

  try {
    const response = await generateObject({
      model: geminiModel,
      schema: parsedLinkedInProfileSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text" as const, text: prompt },
            { type: "file" as const, data: buffer, mediaType: "application/pdf" }
          ]
        }
      ]
    });
    return response.object;
  } catch (error) {
    console.error("PDF Parsing failed:", error);
    throw new Error("Failed to parse LinkedIn PDF profile.");
  }
}
