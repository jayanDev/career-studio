"use server";

import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateJsonWithGemini } from "@/lib/ai";

const naturalSearchSchema = z.object({
  query: z.string().trim().min(2, "Search query is too short"),
});

const evaluateMatchSchema = z.object({
  talentProfileId: z.string().uuid(),
  jobDescription: z.string().trim().min(50, "Job description is too short to evaluate"),
});

const naturalSearchResultSchema = z.object({
  title: z.string().nullable(),
  skills: z.array(z.string()),
  district: z.string().nullable(),
  careerLevel: z.string().nullable(),
  booleanQuery: z.string(),
});

const candidateEvaluationSchema = z.object({
  matchScore: z.number().min(0).max(100),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  summary: z.string(),
  redFlags: z.array(z.string()),
});

/**
 * Translates natural language into structured search filters and boolean keywords.
 */
export async function parseNaturalSearch(data: z.infer<typeof naturalSearchSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = naturalSearchSchema.parse(data);

  const prompt = `You are an expert technical recruiter and search query parser.
Analyze this natural language search query and convert it into structured search filters.
Identify the job title, essential skills, location/district (Sri Lankan districts if applicable), experience level, and a boolean keyword string.

Query: "${parsed.query}"

Return a JSON object conforming strictly to this schema:
{
  "title": "Extracted job title or null",
  "skills": ["Array of distinct skills", "React", "Node"],
  "district": "Extracted district or null",
  "careerLevel": "Extracted level (junior, mid, senior, lead) or null",
  "booleanQuery": "Construct a boolean search string using AND/OR with the extracted keywords. E.g., 'React AND Node.js OR Python'"
  }`;

  try {
    return await generateJsonWithGemini(prompt, naturalSearchResultSchema);
  } catch (error) {
    console.error("AI Parse Error:", error);
    const lower = parsed.query.toLowerCase();
    const skills = ["python", "django", "react", "next.js", "java", "aws", "kubernetes", "sql", "figma"]
      .filter((skill) => lower.includes(skill))
      .map((skill) => skill.replace(/^./, (char) => char.toUpperCase()));
    const district = ["colombo", "kandy", "galle", "jaffna", "gampaha"].find((item) => lower.includes(item));
    const careerLevel = ["junior", "mid", "senior", "lead"].find((item) => lower.includes(item));
    return {
      title: lower.includes("engineer") ? "Engineer" : lower.includes("designer") ? "Designer" : null,
      skills,
      district: district ? district.replace(/^./, (char) => char.toUpperCase()) : null,
      careerLevel: careerLevel || null,
      booleanQuery: skills.length ? skills.join(" AND ") : parsed.query,
    };
  }
}

/**
 * Evaluates a specific candidate against a job description.
 */
export async function evaluateCandidateMatch(data: z.infer<typeof evaluateMatchSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = evaluateMatchSchema.parse(data);

  // Fetch candidate data
  const candidate = await prisma.talentProfile.findUnique({
    where: { id: parsed.talentProfileId },
    include: {
      skills: true,
      experiences: true,
      educations: true,
      certifications: true,
    }
  });

  if (!candidate) throw new Error("Candidate not found");

  // Compile candidate context
  const candidateContext = `
Headline: ${candidate.headline}
Bio: ${candidate.bio}
Skills: ${candidate.skills.map(s => s.name).join(", ")}
Experience: ${candidate.experiences.map(e => `${e.title} at ${e.companyName} (${e.description})`).join(" | ")}
Education: ${candidate.educations.map(e => `${e.degree} from ${e.institutionName}`).join(" | ")}
  `;

  const prompt = `You are a Senior Technical Recruiter evaluating a candidate profile against a specific Job Description (JD).
  
Job Description:
${parsed.jobDescription}

Candidate Profile:
${candidateContext}

Provide a detailed evaluation JSON object with the following schema:
{
  "matchScore": 85, // Number 0-100 indicating how well they match
  "pros": ["Strong React experience", "Matches required education"], // Array of strings (3-5 items)
  "cons": ["Missing AWS cloud experience", "Shorter tenure than requested"], // Array of strings (1-3 items)
  "summary": "Short 2-3 sentence summary of your recommendation.",
  "redFlags": ["Any potential red flags or gaps, or empty array if none"]
  }`;

  try {
    return await generateJsonWithGemini(prompt, candidateEvaluationSchema);
  } catch (error) {
    console.error("AI Evaluation Error:", error);
    throw new Error("Failed to evaluate candidate match");
  }
}
