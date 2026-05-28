/**
 * Resume parsing simulator — the "what the ATS sees" feature.
 *
 * Real ATS systems (Sovren, Daxtra, Affinda) use heuristic resume parsers
 * trained on millions of CVs. We approximate that by:
 *   1. Running a fast regex-based heuristic pass (always available, free).
 *   2. Optionally replacing it with a Gemini structured parse for higher
 *      fidelity when an API key is present.
 *
 * The output shape mirrors what a recruiter sees in Workday / Greenhouse
 * after their parser runs. Each section carries a `confidence` so the UI
 * can flag low-confidence parses for the user to correct.
 */

import { z } from "zod";

import { generateJsonWithGemini } from "@/lib/ai";
import { captureError } from "@/lib/observability";

const contactSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  website: z.string().nullable(),
});

const experienceSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  start_date: z.string().nullable().describe("ISO month e.g. 2022-03 or null."),
  end_date: z.string().nullable().describe("ISO month, 'present', or null."),
  bullets: z.array(z.string()),
});

const educationSchema = z.object({
  degree: z.string(),
  field: z.string().nullable(),
  institution: z.string(),
  location: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  gpa: z.string().nullable(),
});

const projectSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  bullets: z.array(z.string()),
  url: z.string().nullable(),
});

export const parsedResumeSchema = z.object({
  contact: contactSchema,
  summary: z.string().nullable(),
  experience: z.array(experienceSchema),
  education: z.array(educationSchema),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
  projects: z.array(projectSchema),
  languages: z.array(z.string()),
});

export type ParsedResume = z.infer<typeof parsedResumeSchema>;

export type ParseConfidence = Record<keyof ParsedResume, "high" | "medium" | "low" | "missing">;

export type ParsedResumeReport = {
  parsed: ParsedResume;
  confidence: ParseConfidence;
  method: "ai" | "heuristic";
};

/* -------------------------------------------------------------------------- */
/*  Heuristic parser (always available, no API key required)                  */
/* -------------------------------------------------------------------------- */

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE =
  /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/;
const LINKEDIN = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-z0-9_-]+/i;
const GITHUB = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-z0-9_-]+/i;
const URL_RE = /https?:\/\/[^\s,]+/i;

const SECTION_HEADINGS: Record<keyof ParsedResume | "header", RegExp> = {
  contact: /^(contact|personal\s+details)\b/im,
  summary: /^(summary|profile|about|objective)\b/im,
  experience: /^(experience|work\s+experience|professional\s+experience|employment(\s+history)?|work\s+history)\b/im,
  education: /^(education|academic(\s+background)?|qualifications)\b/im,
  skills: /^(skills|technical\s+skills|core\s+competencies|competencies)\b/im,
  certifications: /^(certifications?|licenses?)\b/im,
  projects: /^(projects|portfolio)\b/im,
  languages: /^(languages)\b/im,
  header: /^.{0,200}$/, // catch-all
};

function findFirstLine(text: string, pattern: RegExp): number {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (pattern.test(lines[i].trim())) return i;
  }
  return -1;
}

function sliceSection(text: string, name: keyof ParsedResume): string {
  const lines = text.split("\n");
  const start = findFirstLine(text, SECTION_HEADINGS[name]);
  if (start === -1) return "";
  // Section runs until the next known heading
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    for (const key of Object.keys(SECTION_HEADINGS) as Array<keyof ParsedResume | "header">) {
      if (key === name || key === "header") continue;
      if (SECTION_HEADINGS[key].test(line)) {
        end = i;
        break;
      }
    }
    if (end !== lines.length) break;
  }
  return lines.slice(start + 1, end).join("\n").trim();
}

function parseContact(text: string): ParsedResume["contact"] {
  const head = text.split("\n").slice(0, 8).join("\n");
  const email = head.match(EMAIL)?.[0] ?? null;
  const phone = head.match(PHONE)?.[0] ?? null;
  const linkedin = head.match(LINKEDIN)?.[0] ?? null;
  const github = head.match(GITHUB)?.[0] ?? null;

  // Name = first non-empty line that isn't an email/url/phone.
  let name: string | null = null;
  for (const line of head.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (EMAIL.test(line) || URL_RE.test(line) || PHONE.test(line)) continue;
    if (line.length > 60) continue;
    name = line;
    break;
  }

  // Location = city, country pattern after the name.
  const locMatch = head.match(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?),\s*([A-Z][a-zA-Z]+)\b/);
  const location = locMatch?.[0] ?? null;

  const otherUrl = head.match(URL_RE)?.[0] ?? null;
  const website = otherUrl && otherUrl !== linkedin && otherUrl !== github ? otherUrl : null;

  return { name, email, phone, location, linkedin, github, website };
}

function parseSkills(text: string): string[] {
  const section = sliceSection(text, "skills");
  if (!section) return [];
  // Split on commas, pipes, bullets, or newlines.
  return Array.from(
    new Set(
      section
        .split(/[,|•·\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 40 && !/^\W+$/.test(s)),
    ),
  ).slice(0, 60);
}

function parseList(text: string, name: keyof ParsedResume, max = 30): string[] {
  const section = sliceSection(text, name);
  if (!section) return [];
  return section
    .split(/\n+/)
    .map((s) => s.replace(/^[•·*\-–\s]+/, "").trim())
    .filter((s) => s.length > 1)
    .slice(0, max);
}

function parseExperience(text: string): ParsedResume["experience"] {
  const section = sliceSection(text, "experience");
  if (!section) return [];

  const blocks = section.split(/\n(?=[A-Z][^\n]{2,}\s+at\s+|\d{4}\s*[-–]\s*\d{4}|\d{4}\s*[-–]\s*present)/i);
  const roles: ParsedResume["experience"] = [];

  for (const block of blocks) {
    if (block.trim().length < 20) continue;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Title @ Company on the first line.
    const titleLine = lines[0];
    const atMatch = titleLine.match(/^(.+?)\s+(?:at|@|[-|,])\s+(.+?)(?:\s+[-|,]\s+(.+))?$/);
    const title = atMatch?.[1]?.trim() ?? titleLine;
    const company = atMatch?.[2]?.trim() ?? "Unknown";

    // Dates: first line containing a year range.
    const dateLine = lines.find((l) => /\d{4}/.test(l)) ?? "";
    const dateMatch = dateLine.match(/(\w+\s+\d{4}|\d{4})\s*[-–to]+\s*(\w+\s+\d{4}|\d{4}|present|current)/i);

    const bullets = lines
      .slice(1)
      .filter((l) => /^[•·*\-–]/.test(l) || l.length > 20)
      .map((l) => l.replace(/^[•·*\-–\s]+/, "").trim());

    roles.push({
      title,
      company,
      location: null,
      start_date: dateMatch?.[1] ?? null,
      end_date: dateMatch?.[2] ?? null,
      bullets: bullets.slice(0, 15),
    });

    if (roles.length >= 10) break;
  }

  return roles;
}

function parseEducation(text: string): ParsedResume["education"] {
  const section = sliceSection(text, "education");
  if (!section) return [];

  return section
    .split(/\n(?=[A-Z])/)
    .map((block) => block.trim())
    .filter((b) => b.length > 5)
    .slice(0, 5)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const degree = lines[0] ?? "Unknown";
      const institution = lines[1] ?? "Unknown";
      const dateMatch = block.match(/(\d{4})\s*[-–]\s*(\d{4}|present)/i);
      const gpaMatch = block.match(/(?:GPA|CGPA)[:\s]+([0-9.]+(?:\s*\/\s*[0-9.]+)?)/i);
      return {
        degree,
        field: null,
        institution,
        location: null,
        start_date: dateMatch?.[1] ?? null,
        end_date: dateMatch?.[2] ?? null,
        gpa: gpaMatch?.[1] ?? null,
      };
    });
}

export function parseResumeHeuristic(text: string): ParsedResumeReport {
  const parsed: ParsedResume = {
    contact: parseContact(text),
    summary: sliceSection(text, "summary") || null,
    experience: parseExperience(text),
    education: parseEducation(text),
    skills: parseSkills(text),
    certifications: parseList(text, "certifications", 20),
    projects: parseList(text, "projects", 10).map((line) => ({
      name: line,
      description: null,
      bullets: [],
      url: null,
    })),
    languages: parseList(text, "languages", 10),
  };

  const confidence = scoreConfidence(parsed);
  return { parsed, confidence, method: "heuristic" };
}

function scoreConfidence(parsed: ParsedResume): ParseConfidence {
  const c = parsed.contact;
  const contactScore = [c.name, c.email, c.phone, c.location, c.linkedin].filter(Boolean).length;
  return {
    contact: contactScore >= 4 ? "high" : contactScore >= 2 ? "medium" : contactScore >= 1 ? "low" : "missing",
    summary: parsed.summary && parsed.summary.length > 50 ? "high" : parsed.summary ? "medium" : "missing",
    experience: parsed.experience.length >= 2 ? "high" : parsed.experience.length === 1 ? "medium" : "missing",
    education: parsed.education.length >= 1 ? "high" : "missing",
    skills: parsed.skills.length >= 5 ? "high" : parsed.skills.length >= 1 ? "medium" : "missing",
    certifications: parsed.certifications.length >= 1 ? "high" : "missing",
    projects: parsed.projects.length >= 1 ? "high" : "missing",
    languages: parsed.languages.length >= 1 ? "high" : "missing",
  };
}

/* -------------------------------------------------------------------------- */
/*  AI parser                                                                  */
/* -------------------------------------------------------------------------- */

const AI_PROMPT = (text: string) => `You are an ATS resume parser. Extract the resume below into the
structured schema. Rules:
- Do NOT invent data. If a field is not present, return null or [].
- Dates: prefer ISO month format (YYYY-MM). Use "present" for ongoing roles.
- Bullets: trim leading symbols (•, -, *). Preserve numbers and percentages.
- Skills: deduplicate and normalise capitalisation ("javascript" -> "JavaScript").
- LinkedIn / GitHub: full URLs only.

RESUME:
"""
${text.slice(0, 12000)}
"""`;

export async function parseResume(text: string): Promise<ParsedResumeReport> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return parseResumeHeuristic(text);
  }

  try {
    const parsed = await generateJsonWithGemini(AI_PROMPT(text), parsedResumeSchema);
    return { parsed, confidence: scoreConfidence(parsed), method: "ai" };
  } catch (error) {
    // Heuristic fallback is materially weaker; surface the failure so a
    // stream of these (quota / outage / schema drift) is visible.
    captureError(error, {
      feature: "ats:resume-parse",
      extra: { textLength: text.length },
    });
    return parseResumeHeuristic(text);
  }
}
