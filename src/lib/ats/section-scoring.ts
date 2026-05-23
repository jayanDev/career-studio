/**
 * Per-section sub-scoring (P2-10).
 *
 * The legacy ATS score is 4 components of 25 each (Format, Content,
 * Keywords, Length). This module produces an *alternative* breakdown
 * keyed by resume section, using the parsed simulator output:
 *
 *   Contact      10  — completeness + validation hits
 *   Summary      15  — present, length, mentions JD-relevant skills
 *   Experience   35  — role count, bullet quality (impact score), tense
 *   Skills       20  — count + relevance to JD hard skills
 *   Education    15  — present, degree + institution detected
 *   Other         5  — certifications / projects / languages
 *
 * Total: 100. This view is shown alongside the legacy breakdown so the
 * user can see which section is dragging the score down.
 */

import type { BulletReport } from "@/lib/ats/bullets";
import type { ContactReport } from "@/lib/ats/contact-validation";
import type { JdMatchResult } from "@/lib/ats/jd-extraction";
import type { ParsedResume } from "@/lib/ats/parse-sections";

export type SectionSubScore = {
  key: "contact" | "summary" | "experience" | "skills" | "education" | "other";
  label: string;
  score: number;
  max: number;
  reason: string;
};

export type SectionScoreReport = {
  sections: SectionSubScore[];
  total: number;
};

const MAX = { contact: 10, summary: 15, experience: 35, skills: 20, education: 15, other: 5 } as const;

function clamp(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function computeSectionScores(
  parsed: ParsedResume,
  contact: ContactReport,
  bullets: BulletReport,
  jdMatch: JdMatchResult | null,
): SectionScoreReport {
  // Contact: lean on the existing 0-100 contact score.
  const contactScore = clamp((contact.score / 100) * MAX.contact, MAX.contact);

  // Summary: present? long enough? mentions JD skills?
  const summary = parsed.summary ?? "";
  let summaryScore = 0;
  let summaryReason = "Summary not detected";
  if (summary.length >= 30) {
    summaryScore = 8;
    summaryReason = "Summary present";
    if (summary.length >= 200) summaryScore += 3;
    if (summary.length >= 400) summaryScore += 2;
    if (jdMatch) {
      const lower = summary.toLowerCase();
      const skillsInSummary = jdMatch.matched.hard.filter((k) => lower.includes(k.toLowerCase())).length;
      if (skillsInSummary >= 2) {
        summaryScore += 2;
        summaryReason += `, references ${skillsInSummary} JD skills`;
      }
    }
    summaryScore = clamp(summaryScore, MAX.summary);
  }

  // Experience: scaled from bullet impact + role count.
  let experienceScore = 0;
  let experienceReason = "No experience detected";
  if (parsed.experience.length > 0) {
    // 50% from role count (capped at 4 roles giving max), 50% from impact.
    const roleComponent = Math.min(1, parsed.experience.length / 4) * (MAX.experience / 2);
    const impactComponent = (bullets.overallImpactScore / 100) * (MAX.experience / 2);
    experienceScore = clamp(roleComponent + impactComponent, MAX.experience);
    experienceReason = `${parsed.experience.length} role(s), impact score ${bullets.overallImpactScore}/100`;
  }

  // Skills: count + JD relevance.
  let skillsScore = 0;
  let skillsReason = "No skills section detected";
  if (parsed.skills.length > 0) {
    // Up to 10 points from count (cap at 12 skills), up to 10 from JD overlap.
    const countComponent = Math.min(1, parsed.skills.length / 12) * 10;
    let jdComponent = 0;
    if (jdMatch) {
      const required = jdMatch.matched.hard.length + jdMatch.missing.hard.length;
      jdComponent = required === 0 ? 5 : (jdMatch.matched.hard.length / required) * 10;
      skillsReason = `${parsed.skills.length} skills, ${jdMatch.matched.hard.length}/${required} JD hard skills covered`;
    } else {
      jdComponent = 5;
      skillsReason = `${parsed.skills.length} skills detected`;
    }
    skillsScore = clamp(countComponent + jdComponent, MAX.skills);
  }

  // Education: present and complete?
  let educationScore = 0;
  let educationReason = "No education detected";
  if (parsed.education.length > 0) {
    educationScore = 10;
    educationReason = `${parsed.education.length} education entr${parsed.education.length === 1 ? "y" : "ies"}`;
    const ed = parsed.education[0];
    if (ed.start_date || ed.end_date) educationScore += 2;
    if (ed.institution && ed.institution !== "Unknown") educationScore += 3;
    educationScore = clamp(educationScore, MAX.education);
  }

  // Other: certifications, projects, languages.
  const extras = parsed.certifications.length + parsed.projects.length + parsed.languages.length;
  const otherScore = clamp((Math.min(1, extras / 5)) * MAX.other, MAX.other);
  const otherReason = extras
    ? `${parsed.certifications.length} certs, ${parsed.projects.length} projects, ${parsed.languages.length} languages`
    : "No certifications / projects / languages detected";

  const sections: SectionSubScore[] = [
    { key: "contact", label: "Contact", score: contactScore, max: MAX.contact, reason: contact.findings.length ? `${contact.score}/100 health` : "Not detected" },
    { key: "summary", label: "Summary", score: summaryScore, max: MAX.summary, reason: summaryReason },
    { key: "experience", label: "Experience", score: experienceScore, max: MAX.experience, reason: experienceReason },
    { key: "skills", label: "Skills", score: skillsScore, max: MAX.skills, reason: skillsReason },
    { key: "education", label: "Education", score: educationScore, max: MAX.education, reason: educationReason },
    { key: "other", label: "Other", score: otherScore, max: MAX.other, reason: otherReason },
  ];

  const total = sections.reduce((acc, s) => acc + s.score, 0);
  return { sections, total };
}
