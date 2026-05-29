import { describe, expect, it } from "vitest";

import { analyseBullets, type BulletReport } from "@/lib/ats/bullets";
import type { ParsedResume } from "@/lib/ats/parse-sections";

// analyseBullets only reads experience[].{title,company,end_date,bullets},
// so we build minimal roles and cast rather than constructing full resumes.

type RoleLite = {
  title?: string;
  company?: string;
  end_date?: string | null;
  bullets: string[];
};

function makeParsed(roles: RoleLite[]): ParsedResume {
  return {
    contact: {},
    summary: null,
    experience: roles.map((r) => ({
      title: r.title ?? "Engineer",
      company: r.company ?? "Acme",
      start_date: "2019",
      end_date: r.end_date ?? "2020",
      bullets: r.bullets,
    })),
    education: [],
    skills: [],
    certifications: [],
    projects: [],
    languages: [],
  } as unknown as ParsedResume;
}

// Convenience: analyse a single bullet on a past role and return its analysis.
function oneBullet(text: string, end_date = "2020") {
  const report = analyseBullets(makeParsed([{ bullets: [text], end_date }]));
  return report.roles[0].bullets[0];
}

describe("analyseBullets — empty input", () => {
  it("returns a zeroed report when there is no experience", () => {
    const report = analyseBullets(makeParsed([]));
    expect(report.roles).toEqual([]);
    expect(report.overallImpactScore).toBe(0);
    expect(report.totalBullets).toBe(0);
    expect(report.topIssues).toEqual([]);
  });

  it("scores a role with no bullets as 0 average", () => {
    const report = analyseBullets(makeParsed([{ bullets: [] }]));
    expect(report.roles[0].averageScore).toBe(0);
    expect(report.totalBullets).toBe(0);
    expect(report.overallImpactScore).toBe(0);
  });
});

describe("analyseBullets — per-bullet flags & scoring", () => {
  it("awards a perfect 100 for a strong, quantified, well-formed bullet", () => {
    const b = oneBullet("Increased revenue by 40% across 3 regions within 6 months");
    expect(b.flags).toContain("action_verb");
    expect(b.flags).toContain("quantified");
    expect(b.flags).toContain("xyz");
    expect(b.flags).toContain("ideal_length");
    // 50 + 20 (verb) + 20 (quant) + 10 (xyz) + 5 (length) = 105 -> clamped 100
    expect(b.score).toBe(100);
  });

  it("penalises a weak opener and a too-short bullet", () => {
    const b = oneBullet("Responsible for managing the team");
    expect(b.flags).toContain("weak_opener");
    expect(b.flags).toContain("too_short");
    expect(b.flags).not.toContain("action_verb");
    // 50 - 20 (weak) - 10 (short) = 20
    expect(b.score).toBe(20);
  });

  it("flags first-person pronouns and over-long bullets", () => {
    const b = oneBullet(
      "I worked on various projects and I helped my team with many different tasks while we collaborated together on numerous initiatives that spanned several departments across the entire organisation over many years here",
    );
    expect(b.flags).toContain("first_person");
    expect(b.flags).toContain("too_long");
    // 50 - 10 (first person) - 5 (too long) = 35
    expect(b.score).toBe(35);
  });

  it("flags a past-tense action verb in a current role as a tense mismatch", () => {
    const b = oneBullet("Led the engineering team", "Present");
    expect(b.flags).toContain("action_verb");
    expect(b.flags).toContain("tense_mismatch");
    expect(b.flags).toContain("too_short");
    // 50 + 20 (verb) - 5 (tense) - 10 (short) = 55
    expect(b.score).toBe(55);
  });

  it("does not flag a past-tense verb in a past role", () => {
    const b = oneBullet("Led the engineering team and delivered three major launches");
    expect(b.flags).not.toContain("tense_mismatch");
  });

  it("strips leading bullet glyphs before analysing", () => {
    const b = oneBullet("•  Built and shipped a new onboarding flow for users");
    expect(b.text.startsWith("Built")).toBe(true);
    expect(b.flags).toContain("action_verb");
  });
});

describe("analyseBullets — role & overall roll-up", () => {
  it("averages bullet scores per role and across all roles (rounded)", () => {
    const report: BulletReport = analyseBullets(
      makeParsed([
        {
          bullets: [
            "Increased revenue by 40% across 3 regions within 6 months", // 100
            "Responsible for managing the team", // 20
          ],
        },
      ]),
    );
    expect(report.totalBullets).toBe(2);
    expect(report.roles[0].averageScore).toBe(60); // (100 + 20) / 2
    expect(report.overallImpactScore).toBe(60);
  });

  it("counts bullets across multiple roles", () => {
    const report = analyseBullets(
      makeParsed([
        { bullets: ["Built the API", "Shipped the SDK"] },
        { bullets: ["Led the team"] },
      ]),
    );
    expect(report.totalBullets).toBe(3);
    expect(report.roles).toHaveLength(2);
  });

  it("marks a role current from a 'Present' end date", () => {
    const report = analyseBullets(makeParsed([{ bullets: ["Led the team"], end_date: "Present" }]));
    expect(report.roles[0].isCurrent).toBe(true);
  });
});

describe("analyseBullets — topIssues roll-up", () => {
  it("surfaces verb/metric coverage warnings ahead of per-flag counts", () => {
    const report = analyseBullets(
      makeParsed([
        {
          bullets: [
            "Responsible for daily standups", // weak + short
            "Worked on the backend services", // weak + short
            "Helped with documentation and onboarding", // weak + short
          ],
        },
      ]),
    );
    expect(report.topIssues).toEqual([
      "Only 0 of 3 bullets contain a metric — add numbers, %, or $",
      "Only 0 of 3 bullets start with a strong action verb",
      '3 bullets start with weak openers like "responsible for" or "worked on"',
      "3 bullets are shorter than 8 words",
    ]);
  });

  it("caps topIssues at 6 entries", () => {
    const report = analyseBullets(
      makeParsed([
        {
          bullets: [
            "Responsible for daily standups",
            "I worked on stuff",
            "Helped with documentation and onboarding new hires across the entire company and many teams over the years here doing things",
          ],
          end_date: "Present",
        },
      ]),
    );
    expect(report.topIssues.length).toBeLessThanOrEqual(6);
  });
});
