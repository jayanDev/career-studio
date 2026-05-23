/**
 * Section presence audit.
 *
 * The previous content scorer awarded 5 points each for the strings
 * "experience", "education", "skills" appearing anywhere in the text.
 * That misses two things:
 *   - The word can appear without being a real section (e.g. "I have
 *     extensive experience in...").
 *   - It doesn't distinguish required from recommended sections.
 *
 * This module piggybacks on the parsing-simulator output (which already
 * knows which sections were detected with what confidence) and produces a
 * clean required/recommended split with a penalty applied to the Content
 * sub-score.
 */

import type { ParsedResume, ParseConfidence } from "@/lib/ats/parse-sections";

export type SectionStatus = "present" | "weak" | "missing";

export type SectionAuditEntry = {
  key: keyof ParsedResume;
  label: string;
  status: SectionStatus;
  required: boolean;
  /** Negative number — how much we deducted from the Content sub-score. */
  penalty: number;
};

export type SectionAudit = {
  entries: SectionAuditEntry[];
  /** Total Content-sub-score penalty (sum of `entries[i].penalty`). */
  contentPenalty: number;
  /** Issues to surface in the issues list. */
  issues: string[];
  /** Counts for the UI summary. */
  presentCount: number;
  missingRequiredCount: number;
  missingRecommendedCount: number;
};

const SECTION_SPEC: Array<{
  key: keyof ParsedResume;
  label: string;
  required: boolean;
  /** Penalty when this section is missing entirely. */
  missingPenalty: number;
  /** Penalty when this section is weak / low confidence. */
  weakPenalty: number;
}> = [
  { key: "contact", label: "Contact", required: true, missingPenalty: 6, weakPenalty: 3 },
  { key: "experience", label: "Experience", required: true, missingPenalty: 6, weakPenalty: 3 },
  { key: "education", label: "Education", required: true, missingPenalty: 4, weakPenalty: 2 },
  { key: "skills", label: "Skills", required: true, missingPenalty: 4, weakPenalty: 2 },
  { key: "summary", label: "Summary", required: false, missingPenalty: 2, weakPenalty: 0 },
  { key: "certifications", label: "Certifications", required: false, missingPenalty: 1, weakPenalty: 0 },
  { key: "projects", label: "Projects", required: false, missingPenalty: 1, weakPenalty: 0 },
];

function statusFromConfidence(c: ParseConfidence[keyof ParseConfidence]): SectionStatus {
  if (c === "high") return "present";
  if (c === "medium") return "present";
  if (c === "low") return "weak";
  return "missing";
}

export function auditSections(parsed: ParsedResume, confidence: ParseConfidence): SectionAudit {
  const entries: SectionAuditEntry[] = [];
  const issues: string[] = [];
  let contentPenalty = 0;
  let presentCount = 0;
  let missingRequiredCount = 0;
  let missingRecommendedCount = 0;

  for (const spec of SECTION_SPEC) {
    const status = statusFromConfidence(confidence[spec.key]);
    let penalty = 0;

    if (status === "missing") {
      penalty = -spec.missingPenalty;
      if (spec.required) {
        missingRequiredCount += 1;
        issues.push(`Missing required '${spec.label}' section`);
      } else {
        missingRecommendedCount += 1;
        issues.push(`Recommended '${spec.label}' section not detected`);
      }
    } else if (status === "weak") {
      penalty = -spec.weakPenalty;
      if (spec.required && spec.weakPenalty > 0) {
        issues.push(`'${spec.label}' section detected but parses with low confidence`);
      }
      presentCount += 1;
    } else {
      presentCount += 1;
    }

    contentPenalty += penalty;
    entries.push({ key: spec.key, label: spec.label, status, required: spec.required, penalty });
  }

  // Cross-check: an "experience" section that parses zero roles is effectively missing.
  if (parsed.experience.length === 0) {
    const exp = entries.find((e) => e.key === "experience");
    if (exp && exp.status !== "missing") {
      exp.status = "missing";
      exp.penalty = -6;
      contentPenalty -= 6 - Math.abs(exp.penalty);
      issues.push("Experience heading found but no individual roles could be parsed");
    }
  }

  return {
    entries,
    contentPenalty,
    issues,
    presentCount,
    missingRequiredCount,
    missingRecommendedCount,
  };
}
