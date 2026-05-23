"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { extractFromPastedText, extractResume } from "@/lib/ats/extract";
import {
  analyseJobDescription,
  matchJdAgainstResume,
  type JdAnalysis,
} from "@/lib/ats/jd-extraction";
import { assertFileSize, detectFileMime, resumeMimeTypes } from "@/lib/validators";

/**
 * Multi-JD scoring (P3-25).
 *
 * Takes one resume (file or pasted text) and an array of JD blocks, then
 * scores the resume against each JD using the same weighted-match logic
 * as the single-JD path. Returns a sorted list ranked by match %.
 *
 * No DB writes — this is a comparison tool, not part of the persisted
 * history. Users should run a single-JD analysis after picking a winner
 * to get the full bullet/section/SL panels.
 */

export type MultiJdEntry = {
  index: number;
  label: string;
  jdTitle: string | null;
  industry: string | null;
  seniority: string;
  matchPct: number;
  matched: { hard: string[]; tools: string[]; certifications: string[] };
  missing: { hard: string[]; tools: string[]; certifications: string[] };
  yearsRequired: number | null;
  error?: string;
};

export type MultiJdResponse = {
  resumeWordCount: number;
  entries: MultiJdEntry[];
  bestIndex: number;
};

const MAX_JDS = 6;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function scoreMultipleJdsAction(formData: FormData): Promise<MultiJdResponse> {
  const session = await auth();
  if (!session?.user?.id) redirect("/en/auth/sign-in");

  const resumeText = formValue(formData, "resumeText");
  const uploaded = formData.get("resumeFile");

  // 1. Extract resume text once.
  let extractedText: string;
  if (uploaded instanceof File && uploaded.size > 0) {
    assertFileSize(uploaded.size, 5 * 1024 * 1024);
    const buffer = Buffer.from(await uploaded.arrayBuffer());
    const detectedMime = await detectFileMime(buffer);
    const browserMime = uploaded.type || detectedMime;
    if (!resumeMimeTypes.has(browserMime) && browserMime !== "text/plain" && detectedMime !== "application/octet-stream") {
      throw new Error("Unsupported resume file type");
    }
    const extracted = await extractResume(buffer, { mime: detectedMime || browserMime, filename: uploaded.name });
    extractedText = extracted.text;
  } else {
    extractedText = extractFromPastedText(resumeText).text;
  }

  if (!extractedText.trim()) {
    throw new Error("Could not read any text from the uploaded resume");
  }

  // 2. Collect JD inputs (jd_0, jd_1, ...) and their labels.
  const jds: Array<{ index: number; label: string; text: string }> = [];
  for (let i = 0; i < MAX_JDS; i += 1) {
    const text = formValue(formData, `jd_${i}`).trim();
    if (!text) continue;
    const label = formValue(formData, `jd_label_${i}`).trim() || `JD ${i + 1}`;
    jds.push({ index: i, label, text });
  }

  if (jds.length === 0) {
    throw new Error("Add at least one job description to compare");
  }

  // 3. Analyse all JDs in parallel and match each against the resume.
  const entries: MultiJdEntry[] = await Promise.all(
    jds.map(async ({ index, label, text }): Promise<MultiJdEntry> => {
      try {
        const analysis: JdAnalysis = await analyseJobDescription(text);
        const match = matchJdAgainstResume(analysis, extractedText);
        return {
          index,
          label,
          jdTitle: analysis.job_title,
          industry: analysis.industry,
          seniority: analysis.seniority,
          matchPct: match.matchPct,
          matched: {
            hard: match.matched.hard,
            tools: match.matched.tools,
            certifications: match.matched.certifications,
          },
          missing: {
            hard: match.missing.hard,
            tools: match.missing.tools,
            certifications: match.missing.certifications,
          },
          yearsRequired: analysis.years_experience,
        };
      } catch (error) {
        return {
          index,
          label,
          jdTitle: null,
          industry: null,
          seniority: "unspecified",
          matchPct: 0,
          matched: { hard: [], tools: [], certifications: [] },
          missing: { hard: [], tools: [], certifications: [] },
          yearsRequired: null,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  entries.sort((a, b) => b.matchPct - a.matchPct);
  const bestIndex = entries[0]?.index ?? 0;

  return {
    resumeWordCount: extractedText.trim().split(/\s+/).length,
    entries,
    bestIndex,
  };
}
