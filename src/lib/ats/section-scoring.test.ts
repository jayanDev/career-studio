import { describe, expect, it } from "vitest";

import type { BulletReport } from "@/lib/ats/bullets";
import type { ContactReport } from "@/lib/ats/contact-validation";
import type { JdMatchResult } from "@/lib/ats/jd-extraction";
import type { ParsedResume } from "@/lib/ats/parse-sections";
import {
  computeSectionScores,
  type SectionScoreReport,
  type SectionSubScore,
} from "@/lib/ats/section-scoring";

// computeSectionScores only reads a handful of fields off each dependency,
// so we build minimal stand-ins and cast rather than constructing full objects.

type EducationLite = { start_date?: string | null; end_date?: string | null; institution?: string };

function makeParsed(fields: {
  summary?: string | null;
  experienceCount?: number;
  skills?: string[];
  education?: EducationLite[];
  certifications?: string[];
  projects?: number;
  languages?: string[];
} = {}): ParsedResume {
  return {
    contact: {},
    summary: fields.summary ?? null,
    experience: Array.from({ length: fields.experienceCount ?? 0 }, () => ({})),
    education: fields.education ?? [],
    skills: fields.skills ?? [],
    certifications: fields.certifications ?? [],
    projects: Array.from({ length: fields.projects ?? 0 }, () => ({})),
    languages: fields.languages ?? [],
  } as unknown as ParsedResume;
}

function makeContact(score: number, findingsLen = 1): ContactReport {
  return {
    findings: Array.from({ length: findingsLen }, () => ({})),
    issues: [],
    score,
  } as unknown as ContactReport;
}

function makeBullets(overallImpactScore: number): BulletReport {
  return { overallImpactScore } as unknown as BulletReport;
}

function makeJd(matchedHard: string[], missingHard: string[]): JdMatchResult {
  return {
    matched: { hard: matchedHard, soft: [] },
    missing: { hard: missingHard, soft: [] },
  } as unknown as JdMatchResult;
}

function sec(report: SectionScoreReport, key: SectionSubScore["key"]): SectionSubScore {
  const s = report.sections.find((x) => x.key === key);
  if (!s) throw new Error(`section ${key} missing`);
  return s;
}

describe("computeSectionScores — empty resume", () => {
  it("scores every section 0 when nothing is detected", () => {
    const report = computeSectionScores(makeParsed(), makeContact(0, 0), makeBullets(0), null);
    expect(report.total).toBe(0);
    for (const s of report.sections) expect(s.score).toBe(0);
  });

  it("exposes all six sections with their documented maxima", () => {
    const report = computeSectionScores(makeParsed(), makeContact(0, 0), makeBullets(0), null);
    expect(report.sections.map((s) => [s.key, s.max])).toEqual([
      ["contact", 10],
      ["summary", 15],
      ["experience", 35],
      ["skills", 20],
      ["education", 15],
      ["other", 5],
    ]);
  });
});

describe("computeSectionScores — contact", () => {
  it("scales the 0-100 contact health onto the 10-point max", () => {
    expect(sec(computeSectionScores(makeParsed(), makeContact(100), makeBullets(0), null), "contact").score).toBe(10);
    expect(sec(computeSectionScores(makeParsed(), makeContact(50), makeBullets(0), null), "contact").score).toBe(5);
  });
});

describe("computeSectionScores — summary", () => {
  it("awards 8 for a present summary, scaling up with length", () => {
    const base = makeContact(0, 0);
    expect(sec(computeSectionScores(makeParsed({ summary: "a".repeat(30) }), base, makeBullets(0), null), "summary").score).toBe(8);
    expect(sec(computeSectionScores(makeParsed({ summary: "a".repeat(200) }), base, makeBullets(0), null), "summary").score).toBe(11);
    expect(sec(computeSectionScores(makeParsed({ summary: "a".repeat(400) }), base, makeBullets(0), null), "summary").score).toBe(13);
  });

  it("adds 2 when the summary references >= 2 JD hard skills", () => {
    const jd = makeJd(["React", "Node"], []);
    const summary = "Experienced engineer skilled in react and node building products.";
    const s = sec(computeSectionScores(makeParsed({ summary }), makeContact(0, 0), makeBullets(0), jd), "summary");
    expect(s.score).toBe(10); // 8 present + 2 skills
    expect(s.reason).toContain("references 2 JD skills");
  });
});

describe("computeSectionScores — experience", () => {
  it("blends role count and bullet impact (half each)", () => {
    // 2 roles => min(1, 2/4)=0.5 * 17.5 = 8.75; impact 50 => 8.75; sum 17.5 -> 18
    expect(sec(computeSectionScores(makeParsed({ experienceCount: 2 }), makeContact(0, 0), makeBullets(50), null), "experience").score).toBe(18);
  });

  it("hits the 35-point max at 4+ roles with full impact", () => {
    expect(sec(computeSectionScores(makeParsed({ experienceCount: 4 }), makeContact(0, 0), makeBullets(100), null), "experience").score).toBe(35);
  });
});

describe("computeSectionScores — skills", () => {
  it("uses count plus a neutral 5 when no JD is supplied", () => {
    // 12 skills => count 10, jd component 5 => 15
    expect(sec(computeSectionScores(makeParsed({ skills: Array(12).fill("x") }), makeContact(0, 0), makeBullets(0), null), "skills").score).toBe(15);
  });

  it("rewards JD hard-skill coverage", () => {
    // 4 skills => count min(1,4/12)*10 = 3.33; jd 2/4*10 = 5; sum 8.33 -> 8
    const jd = makeJd(["A", "B"], ["C", "D"]);
    expect(sec(computeSectionScores(makeParsed({ skills: Array(4).fill("x") }), makeContact(0, 0), makeBullets(0), jd), "skills").score).toBe(8);
  });
});

describe("computeSectionScores — education & other", () => {
  it("adds points for dates and a known institution", () => {
    const ed = [{ start_date: "2018", institution: "MIT" }];
    expect(sec(computeSectionScores(makeParsed({ education: ed }), makeContact(0, 0), makeBullets(0), null), "education").score).toBe(15);
  });

  it("gives a bare education entry the base 10", () => {
    const ed = [{ institution: "Unknown" }];
    expect(sec(computeSectionScores(makeParsed({ education: ed }), makeContact(0, 0), makeBullets(0), null), "education").score).toBe(10);
  });

  it("scores the Other bucket from cert/project/language count", () => {
    const report = computeSectionScores(
      makeParsed({ certifications: ["a", "b"], projects: 2, languages: ["en"] }),
      makeContact(0, 0),
      makeBullets(0),
      null,
    );
    expect(sec(report, "other").score).toBe(5); // 5 extras -> full 5 points
  });
});

describe("computeSectionScores — total", () => {
  it("sums the sections for a strong resume", () => {
    const report = computeSectionScores(
      makeParsed({
        summary: "a".repeat(200),
        experienceCount: 4,
        skills: Array(12).fill("x"),
        education: [{ start_date: "2018", institution: "MIT" }],
        certifications: ["a", "b", "c", "d", "e"],
      }),
      makeContact(100),
      makeBullets(100),
      null,
    );
    // 10 + 11 + 35 + 15 + 15 + 5
    expect(report.total).toBe(91);
  });
});
