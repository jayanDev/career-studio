/**
 * Job-description analysis.
 *
 * Replaces the substring-only keyword match with a Gemini-structured parse:
 * we separate hard skills, soft skills, tools, certifications, and pull out
 * the required years-of-experience + seniority + education level.
 *
 * Hard skills are scored 3x soft skills when matching against the resume
 * (see ats-scoring v2). The structured shape is also what powers the
 * "missing keywords with placement hints" feature (P1-7).
 */

import { z } from "zod";

import { generateJsonWithGemini } from "@/lib/ai";
import { extractJdKeywords } from "@/lib/ats-scoring";
import { resumeMentionsSkill } from "@/lib/ats/skill-taxonomy";

export const jdAnalysisSchema = z.object({
  hard_skills: z
    .array(z.string())
    .describe("Concrete technical skills, languages, frameworks, platforms required to do the job."),
  soft_skills: z
    .array(z.string())
    .describe("Interpersonal / behavioural competencies (e.g. communication, leadership)."),
  tools: z
    .array(z.string())
    .describe("Named software, SaaS products, or platforms (e.g. Jira, Figma, Salesforce)."),
  certifications: z
    .array(z.string())
    .describe("Named certifications (e.g. AWS Solutions Architect, CA Sri Lanka)."),
  years_experience: z
    .number()
    .min(0)
    .max(40)
    .nullable()
    .describe("Minimum total years of relevant experience required. Null if unspecified."),
  seniority: z
    .enum(["intern", "entry", "junior", "mid", "senior", "lead", "principal", "executive", "unspecified"])
    .describe("Seniority level implied by the JD."),
  education_level: z
    .enum(["none", "diploma", "bachelors", "masters", "phd", "unspecified"])
    .describe("Minimum education level required."),
  job_title: z.string().describe("Best-guess canonical job title."),
  industry: z.string().describe("Industry the role sits in (e.g. fintech, apparel, BPO)."),
});

export type JdAnalysis = z.infer<typeof jdAnalysisSchema>;

const PROMPT = (jd: string) => `You are an ATS analyst. Extract structured requirements from the
job description below. Be conservative — do not invent skills that aren't implied by the text.

Rules:
- Normalise skill names ("JS" -> "JavaScript", "k8s" -> "Kubernetes").
- A skill that is both a tool and a hard skill goes in BOTH arrays.
- Certifications include local Sri Lankan ones (CA Sri Lanka, CMA SL, AAT SL, ACCA, CIMA).
- years_experience: extract the LOWEST number mentioned ("3-5 years" -> 3). Null if absent.
- soft_skills: only include if explicitly mentioned, not inferred.

JOB DESCRIPTION:
"""
${jd.trim().slice(0, 8000)}
"""`;

/**
 * Deterministic fallback used when Gemini is unavailable (no key, network
 * error, rate limit). Returns the legacy keyword list bucketed into hard
 * skills so the rest of the pipeline still works.
 */
export function fallbackJdAnalysis(jobDescription: string): JdAnalysis {
  const keywords = extractJdKeywords(jobDescription, 30);
  return {
    hard_skills: keywords,
    soft_skills: [],
    tools: [],
    certifications: [],
    years_experience: null,
    seniority: "unspecified",
    education_level: "unspecified",
    job_title: "Unknown",
    industry: "Unknown",
  };
}

export async function analyseJobDescription(jobDescription: string): Promise<JdAnalysis> {
  const trimmed = jobDescription.trim();
  if (!trimmed) return fallbackJdAnalysis("");

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return fallbackJdAnalysis(trimmed);
  }

  try {
    return await generateJsonWithGemini(PROMPT(trimmed), jdAnalysisSchema);
  } catch (error) {
    // Soft-fail: scoring should never block on the AI path being down.
    console.warn("[ats] Gemini JD extraction failed, using fallback:", error);
    return fallbackJdAnalysis(trimmed);
  }
}

/**
 * Match an analysed JD against resume text and return a weighted match
 * percentage + the missing keywords bucketed by category (so the UI can
 * suggest where to place each one).
 */
export type JdMatchResult = {
  matchPct: number;
  matched: { hard: string[]; soft: string[]; tools: string[]; certifications: string[] };
  missing: { hard: string[]; soft: string[]; tools: string[]; certifications: string[] };
  weighted: { earned: number; possible: number };
};

const WEIGHTS = { hard: 3, soft: 1, tools: 2, certifications: 2 } as const;

function contains(text: string, keyword: string) {
  const needle = keyword.toLowerCase().trim();
  if (!needle) return false;
  // Skill-taxonomy aware match: also recognises synonyms
  // (JS/JavaScript/ES6, AWS/Amazon Web Services, etc.).
  if (resumeMentionsSkill(text, keyword)) return true;
  // Word-boundary match where possible; fall back to substring for multi-word.
  if (/^[a-z0-9]+$/i.test(needle)) {
    return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
  }
  return text.includes(needle);
}

export function matchJdAgainstResume(jd: JdAnalysis, resumeText: string): JdMatchResult {
  const lower = resumeText.toLowerCase();
  const bucket = (keywords: string[]) => {
    const matched: string[] = [];
    const missing: string[] = [];
    for (const k of keywords) {
      (contains(lower, k) ? matched : missing).push(k);
    }
    return { matched, missing };
  };

  const hard = bucket(jd.hard_skills);
  const soft = bucket(jd.soft_skills);
  const tools = bucket(jd.tools);
  const certs = bucket(jd.certifications);

  const possible =
    jd.hard_skills.length * WEIGHTS.hard +
    jd.soft_skills.length * WEIGHTS.soft +
    jd.tools.length * WEIGHTS.tools +
    jd.certifications.length * WEIGHTS.certifications;
  const earned =
    hard.matched.length * WEIGHTS.hard +
    soft.matched.length * WEIGHTS.soft +
    tools.matched.length * WEIGHTS.tools +
    certs.matched.length * WEIGHTS.certifications;

  return {
    matchPct: possible === 0 ? 0 : Math.round((earned / possible) * 100),
    matched: {
      hard: hard.matched,
      soft: soft.matched,
      tools: tools.matched,
      certifications: certs.matched,
    },
    missing: {
      hard: hard.missing,
      soft: soft.missing,
      tools: tools.missing,
      certifications: certs.missing,
    },
    weighted: { earned, possible },
  };
}
