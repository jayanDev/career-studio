"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { coverLetterContentSchema, defaultResumeContent, resumeContentSchema } from "@/lib/resume-content";
import { generateJsonWithGemini } from "@/lib/ai";
import { scoreResumeText } from "@/lib/ats-scoring";
import { prisma } from "@/lib/prisma";
import { resumeContentToText } from "@/lib/resume-content";
import { createResumeDraft, getResumeForUser, saveResumeSnapshot } from "@/server/services/resumes/resume-service";

const createResumeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  templateKey: z.string().trim().min(1).max(100),
});

const improveTextSchema = z.object({
  text: z.string().trim().min(3).max(1200),
  type: z.enum(["bullet", "summary"]),
});

const coverLetterSchema = z.object({
  jobTitle: z.string().trim().min(1).max(180),
  companyName: z.string().trim().min(1).max(180),
  jobDescription: z.string().trim().max(5000).default(""),
  tone: z.enum(["PROFESSIONAL", "CONFIDENT", "WARM", "EXECUTIVE"]).default("PROFESSIONAL"),
  profileText: z.string().trim().min(10).max(10000),
});

const gcvThemeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  accent: z.string().trim().min(3).max(30),
  density: z.enum(["compact", "comfortable", "spacious"]),
  template: z.string().trim().min(1).max(80),
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

export async function createResumeFromForm(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = createResumeSchema.parse({
    title: formValue(formData, "title"),
    templateKey: formValue(formData, "templateKey"),
  });
  const resume = await createResumeDraft({
    userId: user.id,
    title: parsed.title,
    templateKey: parsed.templateKey,
  });

  redirect(`/${locale}/resumes/${resume.id}`);
}

export async function createResumeAction(input: z.infer<typeof createResumeSchema>) {
  const user = await requireUser("en");
  const payload = createResumeSchema.parse(input);

  return createResumeDraft({
    userId: user.id,
    title: payload.title,
    templateKey: payload.templateKey,
  });
}

export async function saveResumeContentAction(resumeId: string, content: z.infer<typeof resumeContentSchema>) {
  const user = await requireUser("en");
  const parsed = resumeContentSchema.parse(content);
  const resume = await getResumeForUser(user.id, resumeId);

  if (!resume) {
    throw new Error("Resume not found");
  }

  const previousVersion = resume.content?.version ?? 0;
  await prisma.resumeContent.upsert({
    where: { resumeId },
    create: {
      resumeId,
      data: parsed as Prisma.InputJsonValue,
      sectionOrder: parsed.sectionOrder as Prisma.InputJsonValue,
      version: 1,
    },
    update: {
      data: parsed as Prisma.InputJsonValue,
      sectionOrder: parsed.sectionOrder as Prisma.InputJsonValue,
      version: previousVersion + 1,
    },
  });
  await prisma.resume.update({
    where: { id: resumeId },
    data: { updatedAt: new Date() },
  });
  await saveResumeSnapshot(resumeId, parsed, "Autosaved editor changes");

  return { ok: true, version: previousVersion + 1 };
}

export async function getLiveAtsScoreAction(content: z.infer<typeof resumeContentSchema>) {
  const parsed = resumeContentSchema.parse(content);
  const text = resumeContentToText(parsed);
  const score = scoreResumeText(text);
  
  return {
    overall: score.overall,
    breakdown: score.breakdown,
  };
}

export async function deleteResumeAction(locale: Locale, resumeId: string) {
  const user = await requireUser(locale);
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId: user.id },
    select: { id: true },
  });

  if (resume) {
    await prisma.resume.delete({ where: { id: resume.id } });
  }

  redirect(`/${locale}/resumes`);
}

export async function duplicateResumeAction(locale: Locale, resumeId: string) {
  const user = await requireUser(locale);
  const resume = await getResumeForUser(user.id, resumeId);

  if (!resume) {
    redirect(`/${locale}/resumes`);
  }

  const copy = await prisma.resume.create({
    data: {
      userId: user.id,
      title: `${resume.title} Copy`,
      templateKey: resume.templateKey,
      content: {
        create: {
          data: resume.parsedContent as Prisma.InputJsonValue,
          sectionOrder: resume.parsedContent.sectionOrder as Prisma.InputJsonValue,
        },
      },
    },
  });

  redirect(`/${locale}/resumes/${copy.id}`);
}

export async function improveResumeTextAction(input: z.infer<typeof improveTextSchema>) {
  const parsed = improveTextSchema.parse(input);
  const prompt =
    parsed.type === "summary"
      ? `
            Act as a professional resume writer.
            Rewrite the following professional summary to be more impactful, concise, and professional.
            Provide 3 different options.

            Summary: "${parsed.text}"

            Return ONLY a JSON array of strings:
            ["Option 1", "Option 2", "Option 3"]
            `
      : `
            Act as a professional resume writer.
            Rewrite the following resume bullet point to be more impactful, outcome-oriented, and use strong action verbs.
            Provide 3 different options.

            Bullet Point: "${parsed.text}"

            Return ONLY a JSON array of strings:
            ["Option 1", "Option 2", "Option 3"]
            `;

  try {
    return await generateJsonWithGemini(prompt, z.array(z.string()).length(3));
  } catch {
    if (parsed.type === "summary") {
      return [
        `Results-focused professional with experience delivering measurable improvements, collaborating across teams, and supporting business goals with disciplined execution.`,
        `Adaptable career professional skilled in solving operational problems, communicating clearly, and turning priorities into practical outcomes.`,
        `Motivated professional with a track record of learning quickly, improving workflows, and contributing to team success in fast-moving environments.`,
      ];
    }

    return [
      `Delivered ${parsed.text.toLowerCase()} while improving quality, speed, and stakeholder visibility.`,
      `Managed ${parsed.text.toLowerCase()} with a focus on measurable outcomes and clear team coordination.`,
      `Improved ${parsed.text.toLowerCase()} by applying structured problem solving and consistent follow-through.`,
    ];
  }
}

export async function generateCoverLetterAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = coverLetterSchema.parse({
    jobTitle: formValue(formData, "jobTitle"),
    companyName: formValue(formData, "companyName"),
    jobDescription: formValue(formData, "jobDescription"),
    tone: formValue(formData, "tone") || "PROFESSIONAL",
    profileText: formValue(formData, "profileText"),
  });
  const prompt = `
        You are an expert Career Coach and Copywriter.
        Write a high-impact cover letter based on the Candidate Profile and Target Job.
        Tone: ${parsed.tone}

        CANDIDATE PROFILE:
        ${parsed.profileText.slice(0, 10000)}

        TARGET JOB:
        Title: ${parsed.jobTitle}
        Company: ${parsed.companyName}
        Description: ${parsed.jobDescription.slice(0, 5000)}

        OUTPUT SCHEMA (JSON Only):
        {
            "header_contact": "Full Name | Email | Phone | LinkedIn",
            "recipient_details": "Hiring Manager\\n${parsed.companyName || "Company Name"}",
            "opener": "Strong opening paragraph hooking the reader...",
            "body_paragraphs": ["Paragraph 1 focusing on skills...", "Paragraph 2 focusing on cultural fit..."],
            "achievements": ["Quantifiable achievement 1", "Quantifiable achievement 2"],
            "closing": "Call to action closing...",
            "signature": "Sincerely,\\nFull Name"
        }

        Return ONLY valid JSON.
        `;
  let content = coverLetterContentSchema.parse({
    headerContact: "",
    recipientDetails: `Hiring Manager\n${parsed.companyName}`,
    opener: `I am excited to apply for the ${parsed.jobTitle} role at ${parsed.companyName}.`,
    bodyParagraphs: [
      parsed.profileText.slice(0, 600),
      parsed.jobDescription ? `Your requirements align with my experience in ${parsed.jobDescription.slice(0, 180)}.` : "I bring practical experience, strong communication, and a commitment to measurable results.",
    ],
    achievements: ["Built a clear record of ownership and follow-through", "Collaborated with teams to deliver practical outcomes"],
    closing: "I would welcome the opportunity to discuss how I can contribute to your team.",
    signature: "Sincerely,\n",
  });

  try {
    const aiContent = await generateJsonWithGemini(
      prompt,
      z.object({
        header_contact: z.string(),
        recipient_details: z.string(),
        opener: z.string(),
        body_paragraphs: z.array(z.string()),
        achievements: z.array(z.string()),
        closing: z.string(),
        signature: z.string(),
      })
    );
    content = coverLetterContentSchema.parse({
      headerContact: aiContent.header_contact,
      recipientDetails: aiContent.recipient_details,
      opener: aiContent.opener,
      bodyParagraphs: aiContent.body_paragraphs,
      achievements: aiContent.achievements,
      closing: aiContent.closing,
      signature: aiContent.signature,
    });
  } catch {
    // Keep the deterministic draft when Gemini is unavailable or over quota.
  }

  const letter = await prisma.coverLetter.create({
    data: {
      userId: user.id,
      title: `${parsed.jobTitle} at ${parsed.companyName}`,
      jobTitle: parsed.jobTitle,
      companyName: parsed.companyName,
      jobDescription: parsed.jobDescription,
      tone: parsed.tone,
      content: content as Prisma.InputJsonValue,
    },
  });

  await prisma.coverLetterVersion.create({
    data: {
      coverLetterId: letter.id,
      content: content as Prisma.InputJsonValue,
      versionNumber: 1,
    },
  });

  redirect(`/${locale}/cover-letter/${letter.id}`);
}

export async function updateCoverLetterAction(locale: Locale, letterId: string, formData: FormData) {
  const user = await requireUser(locale);
  const current = await prisma.coverLetter.findFirst({
    where: { id: letterId, userId: user.id },
    select: { id: true },
  });

  if (!current) {
    redirect(`/${locale}/cover-letter`);
  }

  const content = coverLetterContentSchema.parse({
    headerContact: formValue(formData, "headerContact"),
    recipientDetails: formValue(formData, "recipientDetails"),
    opener: formValue(formData, "opener"),
    bodyParagraphs: formValue(formData, "bodyParagraphs").split(/\n{2,}/).map((line) => line.trim()).filter(Boolean),
    achievements: formValue(formData, "achievements").split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean),
    closing: formValue(formData, "closing"),
    signature: formValue(formData, "signature"),
  });

  const lastVersion = await prisma.coverLetterVersion.findFirst({
    where: { coverLetterId: letterId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });

  await prisma.coverLetter.update({
    where: { id: letterId },
    data: { content: content as Prisma.InputJsonValue },
  });
  await prisma.coverLetterVersion.create({
    data: {
      coverLetterId: letterId,
      content: content as Prisma.InputJsonValue,
      versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
    },
  });

  redirect(`/${locale}/cover-letter/${letterId}?saved=1`);
}

export async function createGcvResumeAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = gcvThemeSchema.parse({
    title: formValue(formData, "title"),
    accent: formValue(formData, "accent") || "teal",
    density: formValue(formData, "density") || "comfortable",
    template: formValue(formData, "template") || "modern",
  });
  const content = defaultResumeContent({
    header: {
      fullName: "",
      title: parsed.title,
      email: "",
      phone: "",
      location: "Colombo, Sri Lanka",
      linkedin: "",
      website: "",
    },
  });
  const resume = await prisma.gCVResume.create({
    data: {
      userId: user.id,
      title: parsed.title,
      contentJson: content as Prisma.InputJsonValue,
      themeJson: {
        accent: parsed.accent,
        density: parsed.density,
        template: parsed.template,
      },
    },
  });

  redirect(`/${locale}/gcv/${resume.id}`);
}

export async function updateGcvResumeAction(locale: Locale, resumeId: string, formData: FormData) {
  const user = await requireUser(locale);
  const content = resumeContentSchema.parse(JSON.parse(formValue(formData, "contentJson")));
  const theme = gcvThemeSchema.parse({
    title: formValue(formData, "title"),
    accent: formValue(formData, "accent"),
    density: formValue(formData, "density"),
    template: formValue(formData, "template"),
  });

  await prisma.gCVResume.updateMany({
    where: { id: resumeId, userId: user.id },
    data: {
      title: theme.title,
      contentJson: content as Prisma.InputJsonValue,
      themeJson: {
        accent: theme.accent,
        density: theme.density,
        template: theme.template,
      },
    },
  });

  redirect(`/${locale}/gcv/${resumeId}?saved=1`);
}
