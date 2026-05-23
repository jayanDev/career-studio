"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { scoreResumeText } from "@/lib/ats-scoring";
import { extractResume } from "@/lib/ats/extract";
import {
  analyseJobDescription,
  matchJdAgainstResume,
  type JdAnalysis,
} from "@/lib/ats/jd-extraction";
import { assertFileSize, detectFileMime, resumeMimeTypes } from "@/lib/validators";

/**
 * Bulk recruiter scoring (P3-24).
 *
 * Accepts a single JD plus up to 25 CV files, scores each CV against the
 * JD, and returns a ranked list. This is the recruiter SaaS path —
 * recruiters paste a JD once and bulk-rank a shortlist.
 *
 * Tradeoffs:
 *   - We do NOT persist the per-CV `ATSCheckResult` rows (recruiter
 *     candidates aren't necessarily their CVs to track).
 *   - We run the JD analysis once, then reuse it for every CV.
 *   - PDF/DOCX extraction is the slow path — kept sequential to avoid
 *     blowing memory if a recruiter uploads 25 huge files at once.
 */

const MAX_FILES = 25;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export type BulkScoreEntry = {
  filename: string;
  fileSize: number;
  overall: number;
  format: number;
  content: number;
  keywords: number;
  length: number;
  jdMatchPct: number;
  matchedHardSkills: string[];
  missingHardSkills: string[];
  wordCount: number;
  warning?: string;
  error?: string;
};

export type BulkScoreResponse = {
  jd: { title: string; industry: string; seniority: string; yearsRequired: number | null };
  entries: BulkScoreEntry[];
  succeeded: number;
  failed: number;
};

function failedEntry(filename: string, fileSize: number, message: string): BulkScoreEntry {
  return {
    filename,
    fileSize,
    overall: 0,
    format: 0,
    content: 0,
    keywords: 0,
    length: 0,
    jdMatchPct: 0,
    matchedHardSkills: [],
    missingHardSkills: [],
    wordCount: 0,
    error: message,
  };
}

async function scoreOne(file: File, jd: JdAnalysis): Promise<BulkScoreEntry> {
  if (file.size > MAX_FILE_SIZE) {
    return failedEntry(file.name, file.size, `Exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
  }

  try {
    assertFileSize(file.size, MAX_FILE_SIZE);
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = await detectFileMime(buffer);
    const browserMime = file.type || detectedMime;
    if (!resumeMimeTypes.has(browserMime) && browserMime !== "text/plain" && detectedMime !== "application/octet-stream") {
      return failedEntry(file.name, file.size, "Unsupported file type");
    }

    const extracted = await extractResume(buffer, {
      mime: detectedMime || browserMime,
      filename: file.name,
    });

    if (!extracted.text.trim()) {
      return failedEntry(file.name, file.size, "Could not extract any text");
    }

    const score = scoreResumeText(extracted.text);
    const match = matchJdAgainstResume(jd, extracted.text);

    // Override the keyword sub-score with the structured JD match (same
    // logic as the single-CV path).
    const weightedKeywordScore = Math.round((match.matchPct / 100) * 25);
    const delta = weightedKeywordScore - score.keywords;
    const overall = Math.max(0, Math.min(100, score.overall + delta));

    return {
      filename: file.name,
      fileSize: file.size,
      overall,
      format: score.format,
      content: score.content,
      keywords: weightedKeywordScore,
      length: score.length,
      jdMatchPct: match.matchPct,
      matchedHardSkills: match.matched.hard,
      missingHardSkills: match.missing.hard.slice(0, 12),
      wordCount: extracted.wordCount,
      warning: extracted.warnings[0],
    };
  } catch (error) {
    return failedEntry(
      file.name,
      file.size,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function bulkScoreResumesAction(formData: FormData): Promise<BulkScoreResponse> {
  const session = await auth();
  if (!session?.user?.id) redirect("/en/auth/sign-in");

  const jdText = (formData.get("jobDescription") as string | null)?.trim() ?? "";
  if (!jdText) throw new Error("A job description is required for bulk scoring");

  const files = formData.getAll("resumeFiles").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new Error("Upload at least one CV");
  if (files.length > MAX_FILES) {
    throw new Error(`Maximum ${MAX_FILES} CVs per batch`);
  }

  // 1. Analyse JD once.
  const jd = await analyseJobDescription(jdText);

  // 2. Score each CV against the cached analysis.
  const entries: BulkScoreEntry[] = [];
  for (const file of files) {
    entries.push(await scoreOne(file, jd));
  }

  entries.sort((a, b) => {
    // Errors sink to the bottom.
    if (a.error && !b.error) return 1;
    if (!a.error && b.error) return -1;
    return b.overall - a.overall;
  });

  return {
    jd: {
      title: jd.job_title,
      industry: jd.industry,
      seniority: jd.seniority,
      yearsRequired: jd.years_experience,
    },
    entries,
    succeeded: entries.filter((e) => !e.error).length,
    failed: entries.filter((e) => !!e.error).length,
  };
}
