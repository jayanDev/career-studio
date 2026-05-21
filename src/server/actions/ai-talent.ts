"use server";

import { z } from "zod";

import { auth } from "@/lib/auth";
import { generateJsonWithGemini, generateTextWithGemini } from "@/lib/ai";

const headlineSchema = z.object({
  currentRole: z.string().trim().min(1, "Current role is required"),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  industry: z.string().trim().optional().default(""),
});

const aboutSchema = z.object({
  role: z.string().trim().min(1, "Job title/role is required"),
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  experienceYears: z.number().default(0),
  tone: z.enum(["professional", "fresher", "executive", "technical", "creative"]).default("professional"),
});

const rewriteBulletsSchema = z.object({
  jobTitle: z.string().trim().min(1, "Job title is required"),
  originalDescription: z.string().trim().min(5, "Original description must be at least 5 characters"),
});

export async function generateHeadline(data: z.infer<typeof headlineSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = headlineSchema.parse(data);

  const prompt = `You are a professional CV writer and career coach. Generate 3 compelling, modern LinkedIn-style professional headlines based on:
Role: ${parsed.currentRole}
Skills: ${parsed.skills.join(", ")}
${parsed.industry ? `Industry: ${parsed.industry}` : ""}

Return a JSON object conforming to this schema:
{
  "headlines": [
    "Headline option 1 (e.g. Associate Software Engineer | React | Node.js | QA Automation)",
    "Headline option 2",
    "Headline option 3"
  ]
}
Each headline must be clean, separated by '|', ATS-friendly, and professional. Do not include explanations, just the JSON.`;

  const responseSchema = z.object({
    headlines: z.array(z.string()),
  });

  try {
    const result = await generateJsonWithGemini(prompt, responseSchema);
    return result.headlines;
  } catch (error) {
    console.error("AI headline generation error:", error);
    // Fallback headline
    return [
      `${parsed.currentRole} | ${parsed.skills.slice(0, 3).join(" | ")}`,
      `${parsed.currentRole} specializing in ${parsed.skills.slice(0, 2).join(" & ")}`,
      `Professional ${parsed.currentRole} with expertise in ${parsed.skills[0] || "industry standard tools"}`
    ];
  }
}

export async function generateAbout(data: z.infer<typeof aboutSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = aboutSchema.parse(data);

  const prompt = `You are a senior recruiter. Write an engaging, ATS-optimized, professional 'About' bio summary for a candidate's profile based on:
Role: ${parsed.role}
Skills: ${parsed.skills.join(", ")}
Experience: ${parsed.experienceYears} years
Tone: ${parsed.tone} (e.g. professional, fresher, executive, technical, creative)

Create a summary that:
1. Opens with a strong statement of identity and value.
2. Highlights key technical competencies and soft skills.
3. Mentions career direction and what the candidate aims to achieve.
4. Uses action verbs and is optimized with keywords for ATS.
5. Keeps it concise (3-4 sentences, about 100-150 words).

Return a plain text response. Do not include markdown formatting or quotes.`;

  try {
    const response = await generateTextWithGemini(prompt);
    return response.trim();
  } catch (error) {
    console.error("AI about section generation error:", error);
    return `Results-driven ${parsed.role} with ${parsed.experienceYears}+ years of experience. Skilled in ${parsed.skills.join(", ")}. Proven track record of delivering high-quality solutions and collaborating with cross-functional teams to achieve project success. Seeking opportunities to apply expertise and contribute to team goals.`;
  }
}

export async function rewriteExperienceBullets(data: z.infer<typeof rewriteBulletsSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = rewriteBulletsSchema.parse(data);

  const prompt = `You are an expert ATS optimizer. Rewrite the following description of responsibilities/achievements for a candidate's experience in the role of "${parsed.jobTitle}" into 3-4 professional, action-oriented, and quantified bullet points:
"${parsed.originalDescription}"

Rules for the bullets:
1. Start each bullet point with a strong action verb (e.g., Developed, Managed, Orchestrated, Saved).
2. Quantify achievements where possible (e.g., "improving performance by 25%", "managing a team of 4").
3. Make it ATS-friendly by weaving in keywords related to ${parsed.jobTitle}.
4. Do not prefix with bullet characters (*, -, etc.) as they will be rendered in a list component.

Return a JSON object conforming to this schema:
{
  "bullets": [
    "Bullet point 1",
    "Bullet point 2",
    "Bullet point 3"
  ]
}
Do not include any explanations, only the JSON.`;

  const responseSchema = z.object({
    bullets: z.array(z.string()),
  });

  try {
    const result = await generateJsonWithGemini(prompt, responseSchema);
    return result.bullets;
  } catch (error) {
    console.error("AI experience bullets rewrite error:", error);
    // Simple fallback splitting original text by lines or full stops
    const parts = parsed.originalDescription
      .split(/[.\n]+/)
      .map(p => p.trim())
      .filter(p => p.length > 5)
      .slice(0, 3);
    return parts.length > 0 ? parts : [`Executed responsibilities as a ${parsed.jobTitle}.`, `Collaborated with team members to deliver core project milestones.`, `Leveraged key technical skills to improve daily task efficiency.`];
  }
}
