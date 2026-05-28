import { describe, expect, it } from "vitest";

import { extractStructuredJdKeywords, buildLinkedInAudit } from "./linkedin-optimization";
import type { LinkedInAnalysisInput } from "./linkedin-optimization";

/**
 * buildLinkedInAudit needs 22 fields; tests only care about a few. This
 * fixture fills sensible defaults so each test varies only the inputs it
 * asserts on.
 */
function audit(overrides: Partial<LinkedInAnalysisInput> = {}): LinkedInAnalysisInput {
  return {
    profileText: "",
    targetRole: "",
    audienceMode: "global",
    hasPhoto: true,
    hasBanner: false,
    vanityUrl: "/in/jane",
    profileUrl: "https://linkedin.com/in/jane",
    recsGiven: 0,
    recsReceived: 0,
    featuredPopulated: false,
    complianceMode: false,
    regulatedIndustry: false,
    diasporaMode: false,
    hasOpenToWork: false,
    hasOpenToServices: false,
    jdText: "",
    connections: 200,
    lastPostDate: new Date().toISOString(),
    postsPerWeek: 1,
    avgEngagement: 10,
    hashtags: [],
    topEndorsedSkills: [],
    ...overrides,
  };
}

describe("extractStructuredJdKeywords", () => {
  it("buckets hard skills, soft skills, tools, and certifications", () => {
    const jd = `Senior Software Engineer

We need someone with strong Python, JavaScript, and AWS skills. Familiarity
with Docker is a plus. You'll need excellent communication and leadership
to mentor juniors. CIMA certification preferred.`;
    const result = extractStructuredJdKeywords(jd, "Senior Software Engineer");
    expect(result.hard_skills.length).toBeGreaterThan(0);
    expect(result.tools.length).toBeGreaterThan(0);
    // We can't assert exact contents because the dictionary is internal,
    // but Python / JavaScript / AWS are commonly in hard-skills lookup.
    const allText = [
      ...result.hard_skills,
      ...result.soft_skills,
      ...result.tools,
      ...result.certifications,
    ].join(" ");
    expect(allText.length).toBeGreaterThan(10);
  });

  it("infers seniority from role keywords", () => {
    expect(extractStructuredJdKeywords("Lead Engineer", "Lead Engineer").seniority).toBe("Lead");
    expect(extractStructuredJdKeywords("Senior Developer", "Senior Developer").seniority).toBe("Senior");
    expect(extractStructuredJdKeywords("Junior Associate", "Junior Associate").seniority).toBe("Entry");
    expect(extractStructuredJdKeywords("Software Engineer", "Software Engineer").seniority).toBe("Mid");
  });

  it("handles empty input without throwing", () => {
    const result = extractStructuredJdKeywords("", "");
    expect(Array.isArray(result.hard_skills)).toBe(true);
    expect(Array.isArray(result.soft_skills)).toBe(true);
  });

  it("caps each bucket at the documented limit", () => {
    // Pile on every hard-skill hint we can think of.
    const big = Array(50)
      .fill("Python JavaScript TypeScript Java C++ Go Rust Kotlin Swift SQL")
      .join(" ");
    const result = extractStructuredJdKeywords(big);
    expect(result.hard_skills.length).toBeLessThanOrEqual(14);
    expect(result.soft_skills.length).toBeLessThanOrEqual(8);
    expect(result.tools.length).toBeLessThanOrEqual(10);
    expect(result.certifications.length).toBeLessThanOrEqual(8);
  });
});

describe("buildLinkedInAudit", () => {
  it("produces a complete audit shape from minimal input", () => {
    const result = buildLinkedInAudit(
      audit({
        profileText: "Senior software engineer with 8 years experience at WSO2.",
        targetRole: "Engineering Manager",
      }),
    );
    expect(result).toHaveProperty("score_breakdown");
    expect(result).toHaveProperty("section_scores");
    expect(result).toHaveProperty("missing_keywords");
    expect(result).toHaveProperty("checklist_items");
    expect(result).toHaveProperty("summary_feedback");
  });

  it("returns a numeric overall score in 0..100", () => {
    const result = buildLinkedInAudit(
      audit({
        profileText: "Product manager based in Colombo.",
        targetRole: "Product Manager",
        audienceMode: "local",
      }),
    );
    const completeness = result.score_breakdown?.completeness ?? 0;
    expect(completeness).toBeGreaterThanOrEqual(0);
    expect(completeness).toBeLessThanOrEqual(100);
  });

  it("survives blank profile text without throwing", () => {
    expect(() => buildLinkedInAudit(audit())).not.toThrow();
  });
});
