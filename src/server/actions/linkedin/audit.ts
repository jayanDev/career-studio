"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { generateJsonWithGemini, generateTextWithGemini } from "@/lib/ai";
import { linkedInAuditResultSchema, type LinkedInAuditResult } from "@/lib/linkedin-audit";
import { prisma } from "@/lib/prisma";

const auditFormSchema = z.object({
  targetRole: z.string().trim().min(2).max(255),
  profileText: z.string().trim().max(15000).default(""),
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

function fallbackLinkedInAudit(profileText: string, targetRole: string): LinkedInAuditResult {
  const hasHeadline = /headline|title|specialist|manager|engineer|analyst/i.test(profileText);
  const hasMetrics = /\d+%|\d+x|rs\.|\blkr\b|\d+\+/.test(profileText.toLowerCase());
  const hasSkills = /skills|tools|technologies|certifications/i.test(profileText);
  return {
    score_breakdown: {
      completeness: profileText.length > 800 ? 78 : 52,
      keywords: targetRole ? 62 : 45,
      readability: 74,
      impact: hasMetrics ? 76 : 48,
      consistency: hasHeadline ? 70 : 55,
      recruiter_findability: hasSkills ? 72 : 50,
    },
    missing_keywords: [
      { keyword: targetRole, priority: "HIGH", placement: "Headline and About" },
      { keyword: "Sri Lanka", priority: "MEDIUM", placement: "Location or About" },
      { keyword: "measurable outcomes", priority: "MEDIUM", placement: "Experience bullets" },
    ].filter((item) => item.keyword),
    section_scores: {
      headline: hasHeadline ? 7 : 4,
      about: profileText.length > 500 ? 7 : 4,
      experience: hasMetrics ? 7 : 5,
      skills: hasSkills ? 8 : 4,
    },
    checklist_items: [
      { id: "headline_impact", label: "Headline contains a value proposition and target keywords", completed: hasHeadline, impact: "HIGH" },
      { id: "metrics", label: "Experience includes quantified achievements", completed: hasMetrics, impact: "HIGH" },
      { id: "skills", label: "Skills section reflects the target role", completed: hasSkills, impact: "MEDIUM" },
    ],
    summary_feedback: "Profile has useful raw material, but it needs sharper target-role keywords, stronger metrics, and clearer recruiter-facing positioning.",
  };
}

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

  const parsed = auditFormSchema.parse({
    targetRole: formValue(formData, "targetRole"),
    profileText,
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
      dataJson: { source: filename ? "file" : "text" },
    },
  });

  const roleContext = `Target Role: ${parsed.targetRole || "General Professional"}`;
  const prompt = `
        You are a LinkedIn Profile Expert and Recruiter.
        Audit the following LinkedIn profile text based on best practices for visibility, impact, and clarity.
        ${roleContext}

        PROFILE TEXT:
        ${parsed.profileText.slice(0, 15000)}

        OUTPUT SCHEMA (JSON Only):
        {
            "score_breakdown": {
                "completeness": 80,
                "keywords": 70,
                "readability": 90,
                "impact": 60,
                "consistency": 100,
                "recruiter_findability": 75
            },
            "missing_keywords": [
                {"keyword": "Python", "priority": "HIGH", "placement": "Skills Section"},
                {"keyword": "System Design", "priority": "MEDIUM", "placement": "About Section"}
            ],
            "section_scores": {
                "headline": 8,
                "about": 7,
                "experience": 6,
                "skills": 9,
                "education": 10
            },
            "checklist_items": [
                {"id": "headline_impact", "label": "Headline contains value proposition", "completed": false, "impact": "HIGH"},
                {"id": "about_story", "label": "About section tells a compelling story", "completed": true, "impact": "HIGH"}
            ],
            "summary_feedback": "Overall good profile but needs more quantitative metrics in experience."
        }

        Return ONLY valid JSON.
        `;
  let result = fallbackLinkedInAudit(parsed.profileText, parsed.targetRole);
  try {
    result = linkedInAuditResultSchema.parse(await generateJsonWithGemini(prompt, linkedInAuditResultSchema));
  } catch {
    result = fallbackLinkedInAudit(parsed.profileText, parsed.targetRole);
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

  const prompt = `
        You are a Professional LinkedIn Copywriter.
        Rewrite the following ${parsed.sectionType} section to be optimized for engagement and professional impact.
        Tone: ${parsed.tone}

        ORIGINAL TEXT:
        ${audit.inputText.slice(0, 5000)}

        Return ONLY the rewritten text. Do not include explanations.
        `;
  let rewritten = "Rewrite unavailable. Add more profile text and try again.";
  try {
    rewritten = (await generateTextWithGemini(prompt)).trim();
  } catch {
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
