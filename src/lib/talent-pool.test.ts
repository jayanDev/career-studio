import { describe, expect, it } from "vitest";

import {
  buildCandidateSearchText,
  calculateCandidateConfidence,
  deriveCompanyDomain,
  isAnonymousProfile,
  isWorkEmailVerifiedForDomain,
  parseSalaryExpectation,
  publicCandidateName,
  validateRecruiterSearch,
} from "./talent-pool";

describe("validateRecruiterSearch", () => {
  it("allows neutral queries", () => {
    expect(() => validateRecruiterSearch("python engineer colombo")).not.toThrow();
    expect(() => validateRecruiterSearch("")).not.toThrow();
  });

  it("blocks queries containing prohibited filters", () => {
    // Substrings from the module's banned list.
    expect(() => validateRecruiterSearch("hindu only candidates")).toThrow();
    expect(() => validateRecruiterSearch("must be married")).toThrow();
    expect(() => validateRecruiterSearch("preferred caste")).toThrow();
  });
});

describe("deriveCompanyDomain", () => {
  it("strips protocol + www from a URL", () => {
    expect(deriveCompanyDomain("https://www.acme.lk")).toBe("acme.lk");
    expect(deriveCompanyDomain("http://acme.lk/careers")).toBe("acme.lk");
    expect(deriveCompanyDomain("acme.lk")).toBe("acme.lk");
  });

  it("falls back to email domain when website is empty", () => {
    expect(deriveCompanyDomain("", "jane@acme.lk")).toBe("acme.lk");
  });

  it("returns empty string when neither input is usable", () => {
    expect(deriveCompanyDomain("", "")).toBe("");
    expect(deriveCompanyDomain("", "not-an-email")).toBe("");
  });
});

describe("isWorkEmailVerifiedForDomain", () => {
  it("matches domain case-insensitively", () => {
    expect(isWorkEmailVerifiedForDomain("jane@acme.lk", "acme.lk")).toBe(true);
    expect(isWorkEmailVerifiedForDomain("jane@ACME.LK", "acme.lk")).toBe(true);
  });

  it("rejects mismatches and bad inputs", () => {
    expect(isWorkEmailVerifiedForDomain("jane@gmail.com", "acme.lk")).toBe(false);
    expect(isWorkEmailVerifiedForDomain("", "acme.lk")).toBe(false);
    expect(isWorkEmailVerifiedForDomain("no-at-sign", "acme.lk")).toBe(false);
  });
});

describe("parseSalaryExpectation", () => {
  it("extracts the integer part of LKR-style strings", () => {
    expect(parseSalaryExpectation("Rs 250,000/month")).toBe(250000);
    expect(parseSalaryExpectation("180000")).toBe(180000);
    expect(parseSalaryExpectation("LKR 95,500")).toBe(95500);
  });

  it("returns 0 when no digits are present", () => {
    expect(parseSalaryExpectation("")).toBe(0);
    expect(parseSalaryExpectation("negotiable")).toBe(0);
  });
});

describe("isAnonymousProfile + publicCandidateName", () => {
  it("recognises anonymous visibility", () => {
    expect(isAnonymousProfile("anonymous")).toBe(true);
    expect(isAnonymousProfile("public")).toBe(false);
    expect(isAnonymousProfile("recruiters_only")).toBe(false);
  });

  it("hides name for anonymous, otherwise composes first+last", () => {
    expect(publicCandidateName("Jane", "Doe", "public")).toBe("Jane Doe");
    expect(publicCandidateName("Jane", "Doe", "anonymous")).toBe("Anonymous candidate");
    expect(publicCandidateName("", "", "public")).toBe("Talent Pool Candidate");
  });
});

describe("calculateCandidateConfidence", () => {
  function baseProfile(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      completionScore: 80,
      isVerified: true,
      isOpenToWork: true,
      cvPath: "uploads/cv.pdf",
      updatedAt: new Date(),
      skills: Array.from({ length: 10 }, () => ({} as never)),
      experiences: Array.from({ length: 4 }, () => ({} as never)),
      educations: Array.from({ length: 1 }, () => ({} as never)),
      certifications: Array.from({ length: 2 }, () => ({} as never)),
      ...overrides,
    } as never;
  }

  it("returns a score between 0 and 100", () => {
    const s = calculateCandidateConfidence(baseProfile());
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("rewards completeness and verification", () => {
    const full = calculateCandidateConfidence(baseProfile());
    const minimal = calculateCandidateConfidence(
      baseProfile({
        completionScore: 10,
        isVerified: false,
        isOpenToWork: false,
        cvPath: null,
        skills: [],
        experiences: [],
        certifications: [],
      }),
    );
    expect(full).toBeGreaterThan(minimal);
  });

  it("penalises stale profiles (updatedAt > 30 days ago)", () => {
    const fresh = calculateCandidateConfidence(baseProfile());
    const stale = calculateCandidateConfidence(
      baseProfile({ updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }),
    );
    expect(fresh).toBeGreaterThan(stale);
  });
});

describe("buildCandidateSearchText", () => {
  it("concatenates searchable fields into a single haystack", () => {
    const text = buildCandidateSearchText({
      headline: "Senior backend engineer",
      bio: "Building APIs that scale",
      industry: "FinTech",
      skills: [{ name: "TypeScript" }, { name: "Go" }],
      experiences: [
        { title: "Senior Engineer", companyName: "WSO2", description: "Distributed systems" },
      ],
      educations: [
        { institutionName: "University of Moratuwa", degree: "BSc Engineering", fieldOfStudy: "Computer Science" },
      ],
      certifications: [{ name: "ACCA", issuingOrg: "ACCA Global" }],
    });

    expect(text).toContain("typescript");
    expect(text).toContain("wso2");
    expect(text).toContain("university of moratuwa");
    expect(text).toContain("acca");
  });

  it("handles null / empty fields gracefully", () => {
    const text = buildCandidateSearchText({
      headline: null,
      bio: null,
      industry: null,
      skills: [],
      experiences: [],
      educations: [],
      certifications: [],
    });
    expect(text.length).toBe(0);
  });
});
