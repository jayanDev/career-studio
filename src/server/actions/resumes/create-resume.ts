"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { coverLetterContentSchema, defaultResumeContent, resumeContentSchema, type ResumeContent } from "@/lib/resume-content";
import { generateJsonWithGemini } from "@/lib/ai";
import { scoreResumeText } from "@/lib/ats-scoring";
import {
  buildReferralOpener,
  buildSalaryExpectationLine,
  coverLetterPlainText,
  followUpEmailTemplates,
  generateApplicationComboPack,
  generateEmailReadyCoverLetter,
  generateLinkedInDm,
  normalizeCoverLetterPhone,
  parseCoverLetterJd,
  scoreCoverLetter,
  suggestCompanyResearch,
} from "@/lib/cover-letter-optimization";
import { applyGcvModeToContent, defaultGcvTheme, parseGcvTheme } from "@/lib/gcv-design";
import { prisma } from "@/lib/prisma";
import { resumeContentToText } from "@/lib/resume-content";
import { createResumeDraft, getResumeForUser, saveResumeSnapshot } from "@/server/services/resumes/resume-service";

const createResumeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  templateKey: z.string().trim().min(1).max(100),
});

const improveTextSchema = z.object({
  text: z.string().trim().min(3).max(1200),
  type: z.enum(["bullet", "summary", "achievement"]),
});

const sectionGeneratorSchema = z.object({
  content: resumeContentSchema,
  type: z.enum(["summary", "skills", "achievements"]),
});

const tailorResumeSchema = z.object({
  content: resumeContentSchema,
  jobDescription: z.string().trim().min(20).max(8000),
});

const coverLetterSchema = z.object({
  jobTitle: z.string().trim().min(1).max(180),
  companyName: z.string().trim().min(1).max(180),
  jobDescription: z.string().trim().max(12000).default(""),
  jobUrl: z.string().trim().max(500).default(""),
  tone: z.enum(["PROFESSIONAL", "CONFIDENT", "WARM", "EXECUTIVE", "CONVERSATIONAL", "ENTHUSIASTIC"]).default("PROFESSIONAL"),
  profileText: z.string().trim().max(10000).default(""),
  resumeId: z.string().trim().max(80).default(""),
  lengthTarget: z.enum(["short", "standard", "long"]).default("standard"),
  language: z.enum(["en", "si", "ta", "bilingual_si", "bilingual_ta"]).default("en"),
  mode: z.enum(["local", "international"]).default("international"),
  templateKey: z.string().trim().max(80).default("classic"),
  accentColor: z.string().trim().max(30).default("#0f766e"),
  jobApplicationId: z.string().trim().max(80).default(""),
  referrerName: z.string().trim().max(120).default(""),
  referrerContext: z.string().trim().max(240).default(""),
  salaryMinimum: z.string().trim().max(40).default(""),
  salaryMaximum: z.string().trim().max(40).default(""),
  salaryCurrency: z.string().trim().max(10).default("LKR"),
  salaryPeriod: z.enum(["monthly", "annual"]).default("monthly"),
});

const coverLetterSectionRefineSchema = z.object({
  text: z.string().trim().min(3).max(3000),
  section: z.enum(["opener", "body", "achievement", "closing", "follow_up"]),
  instruction: z.string().trim().max(120).default("Improve"),
  jobTitle: z.string().trim().max(180).default(""),
  companyName: z.string().trim().max(180).default(""),
  jobDescription: z.string().trim().max(8000).default(""),
  tone: z.string().trim().max(40).default("PROFESSIONAL"),
  language: z.string().trim().max(20).default("en"),
});

const coverLetterVariantSchema = z.object({
  content: coverLetterContentSchema,
  jobTitle: z.string().trim().max(180),
  companyName: z.string().trim().max(180),
  jobDescription: z.string().trim().max(8000).default(""),
});

const coverLetterRetargetSchema = z.object({
  content: coverLetterContentSchema,
  jobTitle: z.string().trim().max(180),
  companyName: z.string().trim().max(180),
  jobDescription: z.string().trim().min(20).max(12000),
  tone: z.string().trim().max(40).default("PROFESSIONAL"),
});

const gcvThemeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  accent: z.string().trim().min(3).max(30).default("teal"),
  density: z.enum(["compact", "comfortable", "spacious"]),
  template: z.string().trim().min(1).max(80),
  palette: z.string().trim().max(40).default("teal"),
  fontPairing: z.string().trim().max(60).default("inter-source"),
  layout: z.enum(["one-column", "two-column", "sidebar-left", "sidebar-right", "canvas"]).default("sidebar-left"),
  tone: z.enum(["minimal", "bold", "corporate", "creative", "formal"]).default("minimal"),
  mode: z.enum(["visual", "ats-safe"]).default("visual"),
  language: z.enum(["en", "si", "ta", "mixed"]).default("en"),
  paper: z.enum(["A4", "Letter"]).default("A4"),
  photoShape: z.enum(["square", "circle", "rounded", "hexagon"]).default("rounded"),
  photoFilter: z.enum(["none", "bw", "sepia", "bright"]).default("none"),
  showPhoto: z.boolean().default(true),
  showLogos: z.boolean().default(true),
  showQr: z.boolean().default(true),
  showPortfolio: z.boolean().default(true),
  showMotif: z.boolean().default(false),
  showBleed: z.boolean().default(false),
  animated: z.boolean().default(false),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.enum([
      "header", "summary", "experience", "education", "skills", "projects", "certifications", "languages",
      "awards", "volunteering", "publications", "references", "photo", "skill-bars", "language-bars",
      "timeline", "quote", "portfolio", "divider", "icon-row",
    ]),
    region: z.enum(["header", "main", "sidebar", "footer"]),
    label: z.string(),
    enabled: z.boolean(),
    width: z.enum(["full", "half", "third"]),
    pageBreakBefore: z.boolean().optional(),
  })).default([]),
  portfolioEmbeds: z.array(z.string()).default([]),
  sharePassword: z.string().default(""),
  expiresAt: z.string().default(""),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseJsonFormValue<T>(formData: FormData, key: string, fallback: T): T {
  const value = formValue(formData, key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
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
  if (parsed.mode === "local" && parsed.header.phone) {
    const compact = parsed.header.phone.replace(/[\s-]/g, "");
    if (/^0\d{9}$/.test(compact)) {
      parsed.header.phone = `+94 ${compact.slice(1, 3)} ${compact.slice(3, 6)} ${compact.slice(6)}`;
    }
  }
  if (parsed.mode === "international" && parsed.header.nic) {
    parsed.header.nic = parsed.header.nic.replace(/.(?=.{4})/g, "*");
  }
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
    issues: score.issues.slice(0, 5),
    suggestions: score.suggestions.slice(0, 5),
    sriLankaContext: score.sriLankaContext,
    bulletAnalysis: score.bulletAnalysis,
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
      : parsed.type === "achievement"
      ? `
            Act as a resume achievement coach.
            Turn this duty-style bullet into 3 quantified achievement options. If no number is provided, use honest placeholder wording like "measurable".

            Bullet Point: "${parsed.text}"

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

export async function generateResumeSectionAction(input: z.infer<typeof sectionGeneratorSchema>) {
  const parsed = sectionGeneratorSchema.parse(input);
  const resumeText = resumeContentToText(parsed.content);

  if (parsed.type === "skills") {
    const knownSkills = [
      "Excel", "Communication", "Leadership", "Stakeholder Management", "SQL", "Python", "React",
      "Project Management", "Customer Service", "Data Analysis", "Reporting", "Problem Solving",
      "Power BI", "Agile", "Process Improvement", "Salesforce", "Digital Marketing"
    ];
    const found = knownSkills.filter((skill) => resumeText.toLowerCase().includes(skill.toLowerCase()));
    return { skills: Array.from(new Set([...parsed.content.skills, ...found])).slice(0, 18), text: "" };
  }

  const schema = z.object({ text: z.string(), skills: z.array(z.string()).default([]) });
  const prompt = `
    You are a practical resume writing assistant.
    Use the resume below to generate ${parsed.type === "summary" ? "a 2-4 sentence professional summary" : "3 achievement-style resume bullets"}.

    RESUME:
    ${resumeText.slice(0, 8000)}

    Return JSON only:
    { "text": "...", "skills": [] }
  `;

  try {
    return await generateJsonWithGemini(prompt, schema);
  } catch {
    if (parsed.type === "summary") {
      return {
        text: `Results-focused ${parsed.content.header.title || "professional"} with experience delivering practical improvements, collaborating across teams, and turning priorities into measurable outcomes.`,
        skills: [],
      };
    }
    return {
      text: "Improved team delivery by clarifying requirements, tracking progress, and resolving blockers before deadlines.\nDelivered measurable workflow improvements through structured analysis and stakeholder coordination.\nStrengthened reporting quality by standardising inputs, reviewing trends, and surfacing actionable insights.",
      skills: [],
    };
  }
}

export async function tailorResumeToJobAction(input: z.infer<typeof tailorResumeSchema>) {
  const parsed = tailorResumeSchema.parse(input);
  const score = scoreResumeText(resumeContentToText(parsed.content), parsed.jobDescription);
  const keywords = score.jdTopKeywords?.slice(0, 12) ?? [];
  const missing = keywords.filter((keyword) => !resumeContentToText(parsed.content).toLowerCase().includes(keyword.toLowerCase()));

  const tailored: ResumeContent = {
    ...parsed.content,
    skills: Array.from(new Set([...missing.slice(0, 8), ...parsed.content.skills])).slice(0, 20),
    experience: parsed.content.experience.map((item) => ({
      ...item,
      bullets: [...item.bullets].sort((left, right) => {
        const leftHits = keywords.filter((keyword) => left.toLowerCase().includes(keyword.toLowerCase())).length;
        const rightHits = keywords.filter((keyword) => right.toLowerCase().includes(keyword.toLowerCase())).length;
        return rightHits - leftHits;
      }),
    })),
  };

  return {
    content: tailored,
    matchedKeywords: keywords.filter((keyword) => resumeContentToText(parsed.content).toLowerCase().includes(keyword.toLowerCase())),
    addedSkills: missing.slice(0, 8),
    jdKeywordMatchPct: score.jdKeywordMatchPct ?? 0,
  };
}

export async function checkResumeGrammarAction(content: z.infer<typeof resumeContentSchema>) {
  const parsed = resumeContentSchema.parse(content);
  const text = resumeContentToText(parsed);
  const issues = [
    /\b(responsible for|worked on|helped with)\b/i.test(text)
      ? "Replace weak openers such as 'responsible for', 'worked on', or 'helped with' with action verbs."
      : "",
    /\b(i|me|my|we|our)\b/i.test(text)
      ? "Remove first-person pronouns from resume bullets."
      : "",
    text.split(/\s+/).some((word) => word.length > 28)
      ? "Check very long words for typos."
      : "",
    (text.match(/\s{2,}/g) ?? []).length > 5
      ? "Clean repeated spacing before export."
      : "",
  ].filter(Boolean);

  return { issues };
}

export async function generateCoverLetterAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = coverLetterSchema.parse({
    jobTitle: formValue(formData, "jobTitle"),
    companyName: formValue(formData, "companyName"),
    jobDescription: formValue(formData, "jobDescription"),
    jobUrl: formValue(formData, "jobUrl"),
    tone: formValue(formData, "tone") || "PROFESSIONAL",
    profileText: formValue(formData, "profileText"),
    resumeId: formValue(formData, "resumeId"),
    lengthTarget: formValue(formData, "lengthTarget") || "standard",
    language: formValue(formData, "language") || "en",
    mode: formValue(formData, "mode") || "international",
    templateKey: formValue(formData, "templateKey") || "classic",
    accentColor: formValue(formData, "accentColor") || "#0f766e",
    jobApplicationId: formValue(formData, "jobApplicationId"),
    referrerName: formValue(formData, "referrerName"),
    referrerContext: formValue(formData, "referrerContext"),
    salaryMinimum: formValue(formData, "salaryMinimum"),
    salaryMaximum: formValue(formData, "salaryMaximum"),
    salaryCurrency: formValue(formData, "salaryCurrency") || "LKR",
    salaryPeriod: formValue(formData, "salaryPeriod") || "monthly",
  });
  let profileText = parsed.profileText;
  if (parsed.resumeId) {
    const resume = await prisma.resume.findFirst({
      where: { id: parsed.resumeId, userId: user.id },
      include: { content: true },
    });
    if (resume?.content?.data) {
      profileText = resumeContentToText(resumeContentSchema.parse(resume.content.data));
    }
  }
  if (profileText.trim().length < 10) {
    throw new Error("Add profile text or choose a resume before generating a cover letter.");
  }
  const jdProfile = parseCoverLetterJd({
    jobDescription: parsed.jobDescription,
    jobTitle: parsed.jobTitle,
    companyName: parsed.companyName,
  });
  const referralOpener = buildReferralOpener({
    referrerName: parsed.referrerName,
    referrerContext: parsed.referrerContext,
    jobTitle: parsed.jobTitle,
    companyName: parsed.companyName,
  });
  const salaryExpectation = buildSalaryExpectationLine({
    minimum: parsed.salaryMinimum,
    maximum: parsed.salaryMaximum,
    currency: parsed.salaryCurrency,
    period: parsed.salaryPeriod,
  });
  const companyResearch = suggestCompanyResearch(parsed.companyName, parsed.jobDescription);
  const prompt = `
        You are an expert Career Coach and Copywriter.
        Write a high-impact cover letter based on the Candidate Profile and parsed Target Job.
        Tone: ${parsed.tone}
        Language: ${parsed.language}
        Audience mode: ${parsed.mode}
        Length target: ${parsed.lengthTarget}
        Parsed JD: ${JSON.stringify(jdProfile)}
        Referral opener to include when useful: ${referralOpener || "none"}
        Salary expectation line to include when appropriate: ${salaryExpectation || "none"}
        Company research/tone hints, user must verify before sending: ${companyResearch.join(" | ") || "none"}

        CANDIDATE PROFILE:
        ${profileText.slice(0, 10000)}

        TARGET JOB:
        Title: ${parsed.jobTitle}
        Company: ${parsed.companyName}
        URL: ${parsed.jobUrl || "not provided"}
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
    subject: `${parsed.jobTitle} - ${parsed.companyName} Application`,
    headerContact: "",
    recipientDetails: `Hiring Manager\n${parsed.companyName}`,
    opener: referralOpener || `I am excited to apply for the ${parsed.jobTitle} role at ${parsed.companyName}.`,
    bodyParagraphs: [
      profileText.slice(0, 600),
      parsed.jobDescription ? `Your requirements align with my experience in ${jdProfile.must_have_skills.slice(0, 4).join(", ") || parsed.jobDescription.slice(0, 180)}.` : "I bring practical experience, strong communication, and a commitment to measurable results.",
    ],
    achievements: ["Built a clear record of ownership and follow-through", "Collaborated with teams to deliver practical outcomes"],
    salaryExpectation,
    closing: "I would welcome the opportunity to discuss how I can contribute to your team.",
    signature: "Sincerely,\n",
    language: parsed.language,
    mode: parsed.mode,
    templateKey: parsed.templateKey,
    accentColor: parsed.accentColor,
    lengthTarget: parsed.lengthTarget,
    jobApplicationId: parsed.jobApplicationId,
    jdProfile,
    companyResearch,
    referral: {
      enabled: Boolean(parsed.referrerName),
      referrerName: parsed.referrerName,
      referrerContext: parsed.referrerContext,
    },
    salary: {
      enabled: Boolean(salaryExpectation),
      minimum: parsed.salaryMinimum,
      maximum: parsed.salaryMaximum,
      currency: parsed.salaryCurrency,
      period: parsed.salaryPeriod,
    },
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
      ...content,
      headerContact: aiContent.header_contact,
      recipientDetails: normalizeCoverLetterPhone(aiContent.recipient_details),
      opener: referralOpener || aiContent.opener,
      bodyParagraphs: aiContent.body_paragraphs,
      achievements: aiContent.achievements,
      closing: aiContent.closing,
      signature: normalizeCoverLetterPhone(aiContent.signature),
    });
  } catch {
    // Keep the deterministic draft when Gemini is unavailable or over quota.
  }
  const score = scoreCoverLetter({
    content,
    jobDescription: parsed.jobDescription,
    jobTitle: parsed.jobTitle,
    companyName: parsed.companyName,
    lengthTarget: parsed.lengthTarget,
  });
  content = coverLetterContentSchema.parse({
    ...content,
    qualityScore: score.score,
    qualityLabel: score.label,
    matchedKeywords: score.matchedKeywords,
    missingKeywords: score.missingKeywords,
    grammarIssues: score.grammarIssues,
  });

  const letter = await prisma.coverLetter.create({
    data: {
      userId: user.id,
      resumeId: parsed.resumeId || null,
      title: `${parsed.jobTitle} at ${parsed.companyName}`,
      jobTitle: parsed.jobTitle,
      companyName: parsed.companyName,
      jobDescription: parsed.jobDescription || parsed.jobUrl,
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
    select: { id: true, jobTitle: true, companyName: true, jobDescription: true, content: true },
  });

  if (!current) {
    redirect(`/${locale}/cover-letter`);
  }

  const previousContent = coverLetterContentSchema.parse(current.content);
  let content = coverLetterContentSchema.parse({
    ...previousContent,
    subject: formValue(formData, "subject") || previousContent.subject,
    headerContact: formValue(formData, "headerContact"),
    recipientDetails: formValue(formData, "recipientDetails"),
    opener: formValue(formData, "opener"),
    bodyParagraphs: formValue(formData, "bodyParagraphs").split(/\n{2,}/).map((line) => line.trim()).filter(Boolean),
    achievements: formValue(formData, "achievements").split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean),
    salaryExpectation: formValue(formData, "salaryExpectation"),
    closing: formValue(formData, "closing"),
    signature: formValue(formData, "signature"),
    language: formValue(formData, "language") || previousContent.language,
    mode: formValue(formData, "mode") || previousContent.mode,
    templateKey: formValue(formData, "templateKey") || previousContent.templateKey,
    accentColor: formValue(formData, "accentColor") || previousContent.accentColor,
    lengthTarget: formValue(formData, "lengthTarget") || previousContent.lengthTarget,
    variants: parseJsonFormValue(formData, "variantsJson", previousContent.variants),
    followUpDrafts: parseJsonFormValue(formData, "followUpDraftsJson", previousContent.followUpDrafts),
    emailReady: parseJsonFormValue(formData, "emailReadyJson", previousContent.emailReady),
    linkedInDm: formValue(formData, "linkedInDm") || previousContent.linkedInDm,
    comboPack: parseJsonFormValue(formData, "comboPackJson", previousContent.comboPack),
    performance: parseJsonFormValue(formData, "performanceJson", previousContent.performance),
  });
  const score = scoreCoverLetter({
    content,
    jobDescription: current.jobDescription,
    jobTitle: current.jobTitle,
    companyName: current.companyName,
    lengthTarget: content.lengthTarget,
  });
  content = coverLetterContentSchema.parse({
    ...content,
    qualityScore: score.score,
    qualityLabel: score.label,
    matchedKeywords: score.matchedKeywords,
    missingKeywords: score.missingKeywords,
    grammarIssues: score.grammarIssues,
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

export async function refineCoverLetterSectionAction(input: z.infer<typeof coverLetterSectionRefineSchema>) {
  const parsed = coverLetterSectionRefineSchema.parse(input);
  const prompt = `
    You are a cover-letter editor.
    Rewrite the section according to the instruction while preserving truthful facts.
    Section: ${parsed.section}
    Instruction: ${parsed.instruction}
    Tone: ${parsed.tone}
    Language: ${parsed.language}
    Job: ${parsed.jobTitle} at ${parsed.companyName}
    JD context: ${parsed.jobDescription.slice(0, 3000)}

    SECTION:
    ${parsed.text}

    Return ONLY JSON: { "text": "rewritten section" }
  `;

  try {
    const result = await generateJsonWithGemini(prompt, z.object({ text: z.string() }));
    return { text: result.text };
  } catch {
    const prefix = parsed.instruction.toLowerCase().includes("short")
      ? "Sharper version:"
      : parsed.instruction.toLowerCase().includes("long")
        ? "Expanded version:"
        : "Improved version:";
    return { text: `${prefix} ${parsed.text.replace(/\b(responsible for|worked on|helped with)\b/gi, "delivered").trim()}` };
  }
}

export async function generateCoverLetterVariantsAction(input: z.infer<typeof coverLetterVariantSchema>) {
  const parsed = coverLetterVariantSchema.parse(input);
  const text = coverLetterPlainText(parsed.content);
  const prompt = `
    Create three A/B cover-letter alternatives for ${parsed.jobTitle} at ${parsed.companyName}.
    Goals:
    1. Visibility - keyword-dense and recruiter-search aligned.
    2. Authority - metrics, confidence, and seniority.
    3. Story - warmer narrative arc with a stronger hook.
    JD:
    ${parsed.jobDescription.slice(0, 4000)}

    CURRENT LETTER:
    ${text.slice(0, 6000)}

    Return ONLY JSON:
    [
      { "label": "Visibility", "text": "..." },
      { "label": "Authority", "text": "..." },
      { "label": "Story", "text": "..." }
    ]
  `;

  try {
    return await generateJsonWithGemini(prompt, z.array(z.object({ label: z.string(), text: z.string() })).length(3));
  } catch {
    return [
      { label: "Visibility", text: `${parsed.content.opener}\n\nThis version foregrounds ${parsed.jobTitle}, ${parsed.companyName}, and the highest-priority job-description keywords: ${parsed.content.matchedKeywords.slice(0, 5).join(", ") || "role-specific skills"}.` },
      { label: "Authority", text: `${parsed.content.opener}\n\nI would lead with the strongest quantified achievement and connect it directly to the business outcome this role owns.` },
      { label: "Story", text: `${parsed.content.opener}\n\nWhat makes this opportunity meaningful is the chance to connect my experience with the problems your team is solving now.` },
    ];
  }
}

export async function generateCoverLetterFollowUpAction(input: z.infer<typeof coverLetterVariantSchema>) {
  const parsed = coverLetterVariantSchema.parse(input);
  const name = parsed.content.signature.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) || "Candidate";
  return followUpEmailTemplates({
    jobTitle: parsed.jobTitle,
    companyName: parsed.companyName,
    name,
  });
}

export async function generateCoverLetterUtilityPackAction(input: z.infer<typeof coverLetterVariantSchema>) {
  const parsed = coverLetterVariantSchema.parse(input);
  return {
    emailReady: generateEmailReadyCoverLetter(parsed),
    linkedInDm: generateLinkedInDm(parsed),
    comboPack: generateApplicationComboPack(parsed),
  };
}

export async function retargetCoverLetterAction(input: z.infer<typeof coverLetterRetargetSchema>) {
  const parsed = coverLetterRetargetSchema.parse(input);
  const jdProfile = parseCoverLetterJd({
    jobDescription: parsed.jobDescription,
    jobTitle: parsed.jobTitle,
    companyName: parsed.companyName,
  });
  const prompt = `
    Re-tailor this existing cover letter to the new job description.
    Keep the candidate's truthful claims, but change emphasis, keywords, opener, and closing.
    Tone: ${parsed.tone}
    Parsed JD: ${JSON.stringify(jdProfile)}

    CURRENT LETTER:
    ${coverLetterPlainText(parsed.content).slice(0, 7000)}

    NEW JD:
    ${parsed.jobDescription.slice(0, 7000)}

    Return JSON only:
    {
      "opener": "...",
      "body_paragraphs": ["...", "..."],
      "achievements": ["...", "..."],
      "closing": "..."
    }
  `;

  try {
    const result = await generateJsonWithGemini(
      prompt,
      z.object({
        opener: z.string(),
        body_paragraphs: z.array(z.string()),
        achievements: z.array(z.string()),
        closing: z.string(),
      })
    );
    return coverLetterContentSchema.parse({
      ...parsed.content,
      opener: result.opener,
      bodyParagraphs: result.body_paragraphs,
      achievements: result.achievements,
      closing: result.closing,
      jdProfile,
      companyResearch: suggestCompanyResearch(parsed.companyName, parsed.jobDescription),
    });
  } catch {
    return coverLetterContentSchema.parse({
      ...parsed.content,
      opener: `I am excited to apply for the ${parsed.jobTitle} role at ${parsed.companyName}, especially because the role aligns with ${jdProfile.must_have_skills.slice(0, 3).join(", ") || "my strongest experience"}.`,
      bodyParagraphs: [
        parsed.content.bodyParagraphs[0] || "My background gives me practical context for this role.",
        `For this opportunity, I would emphasise ${[...jdProfile.must_have_skills, ...jdProfile.nice_to_have_skills].slice(0, 5).join(", ") || "the requirements in the job description"} where it is supported by my experience.`,
      ],
      jdProfile,
      companyResearch: suggestCompanyResearch(parsed.companyName, parsed.jobDescription),
    });
  }
}

export async function createGcvResumeAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = gcvThemeSchema.parse({
    title: formValue(formData, "title"),
    accent: formValue(formData, "accent") || "teal",
    density: formValue(formData, "density") || "comfortable",
    template: formValue(formData, "template") || "tech-minimal-stack",
    palette: formValue(formData, "palette") || formValue(formData, "accent") || "teal",
    fontPairing: formValue(formData, "fontPairing") || "inter-source",
    layout: formValue(formData, "layout") || "sidebar-left",
    tone: formValue(formData, "tone") || "minimal",
    mode: formValue(formData, "mode") || "visual",
    language: formValue(formData, "language") || "en",
    paper: formValue(formData, "paper") || "A4",
    photoShape: formValue(formData, "photoShape") || "rounded",
    photoFilter: formValue(formData, "photoFilter") || "none",
    showPhoto: formData.get("showPhoto") === "on",
    showLogos: formData.get("showLogos") === "on",
    showQr: formData.get("showQr") === "on",
    showPortfolio: formData.get("showPortfolio") !== "off",
    showMotif: formData.get("showMotif") === "on",
    showBleed: formData.get("showBleed") === "on",
    animated: formData.get("animated") === "on",
  });
  const theme = defaultGcvTheme(parsed);
  const content = applyGcvModeToContent(defaultResumeContent({
    header: {
      fullName: "",
      title: parsed.title,
      email: "",
      phone: "",
      location: "Colombo, Sri Lanka",
      linkedin: "",
      website: "",
      nic: "",
      street: "",
      district: "",
      postalCode: "",
      photoUrl: "",
      expectedSalary: "",
      salaryPeriod: "monthly",
    },
  }), theme);
  const resume = await prisma.gCVResume.create({
    data: {
      userId: user.id,
      title: parsed.title,
      contentJson: content as Prisma.InputJsonValue,
      themeJson: theme as Prisma.InputJsonValue,
    },
  });

  redirect(`/${locale}/gcv/${resume.id}`);
}

export async function updateGcvResumeAction(locale: Locale, resumeId: string, formData: FormData) {
  const user = await requireUser(locale);
  const content = resumeContentSchema.parse(JSON.parse(formValue(formData, "contentJson")));
  const currentTheme = parseGcvTheme(parseJsonFormValue(formData, "themeJson", {}));
  const theme = gcvThemeSchema.parse({
    title: formValue(formData, "title"),
    ...currentTheme,
  });
  const visualContent = applyGcvModeToContent(content, theme);

  await prisma.gCVResume.updateMany({
    where: { id: resumeId, userId: user.id },
    data: {
      title: theme.title,
      contentJson: visualContent as Prisma.InputJsonValue,
      themeJson: theme as Prisma.InputJsonValue,
    },
  });

  redirect(`/${locale}/gcv/${resumeId}?saved=1`);
}
