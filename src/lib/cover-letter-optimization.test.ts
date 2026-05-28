import { describe, expect, it } from "vitest";

import {
  buildReferralOpener,
  buildSalaryExpectationLine,
  coverLetterLengthRanges,
  coverLetterScoreLabel,
  fillCoverLetterSentence,
  followUpEmailTemplates,
  salutationFor,
  suggestSendingWindow,
} from "./cover-letter-optimization";

describe("coverLetterScoreLabel", () => {
  it("buckets scores into the four labels", () => {
    expect(coverLetterScoreLabel(95)).toBe("Recruiter-ready");
    expect(coverLetterScoreLabel(80)).toBe("Strong, minor polish");
    expect(coverLetterScoreLabel(65)).toBe("Generic - needs tailoring");
    expect(coverLetterScoreLabel(40)).toBe("Major work needed");
  });

  it("honours the exact thresholds", () => {
    expect(coverLetterScoreLabel(90)).toBe("Recruiter-ready");
    expect(coverLetterScoreLabel(75)).toBe("Strong, minor polish");
    expect(coverLetterScoreLabel(60)).toBe("Generic - needs tailoring");
    expect(coverLetterScoreLabel(59)).toBe("Major work needed");
  });
});

describe("coverLetterLengthRanges", () => {
  it("orders short < standard < long", () => {
    expect(coverLetterLengthRanges.short.max).toBeLessThan(coverLetterLengthRanges.standard.min);
    expect(coverLetterLengthRanges.standard.max).toBeLessThan(coverLetterLengthRanges.long.min);
  });
});

describe("buildReferralOpener", () => {
  it("returns a referral sentence with all four fields woven in", () => {
    const sentence = buildReferralOpener({
      referrerName: "Nuwan Perera",
      referrerContext: "managed our backend team",
      jobTitle: "Senior Engineer",
      companyName: "WSO2",
    });
    expect(sentence).toContain("Nuwan Perera");
    expect(sentence).toContain("managed our backend team");
    expect(sentence).toContain("Senior Engineer");
    expect(sentence).toContain("WSO2");
  });

  it("returns empty when no referrer name is given", () => {
    expect(
      buildReferralOpener({
        referrerName: "",
        referrerContext: "anything",
        jobTitle: "Engineer",
        companyName: "Acme",
      }),
    ).toBe("");
  });

  it("falls back to a generic context phrase when referrerContext is empty", () => {
    const sentence = buildReferralOpener({
      referrerName: "Anil",
      referrerContext: "",
      jobTitle: "Designer",
      companyName: "MAS",
    });
    expect(sentence).toContain("knows my work");
  });
});

describe("buildSalaryExpectationLine", () => {
  it("emits a range when both min + max are present", () => {
    const line = buildSalaryExpectationLine({
      minimum: "250000",
      maximum: "350000",
      currency: "LKR",
      period: "per month",
    });
    expect(line).toContain("250000-350000");
    expect(line).toContain("per month");
  });

  it("falls back to a single value when only one bound is present", () => {
    const a = buildSalaryExpectationLine({ minimum: "180000", maximum: "", currency: "LKR", period: "per month" });
    const b = buildSalaryExpectationLine({ minimum: "", maximum: "180000", currency: "LKR", period: "per month" });
    expect(a).toContain("180000");
    expect(b).toContain("180000");
  });

  it("returns empty when neither minimum nor maximum is set", () => {
    expect(
      buildSalaryExpectationLine({ minimum: "", maximum: "", currency: "LKR", period: "per month" }),
    ).toBe("");
  });
});

describe("salutationFor", () => {
  it("uses the hiring manager name when provided", () => {
    expect(salutationFor({ hiringManager: "Anil Perera" })).toBe("Dear Anil Perera");
  });

  it("uses Sinhala / Tamil greetings for matching languages", () => {
    expect(salutationFor({ language: "si" })).toBe("ආයුබෝවන්");
    expect(salutationFor({ language: "ta" })).toBe("வணக்கம்");
    expect(salutationFor({ language: "bilingual_si" })).toBe("ආයුබෝවන්");
    expect(salutationFor({ language: "bilingual_ta" })).toBe("வணக்கம்");
  });

  it("uses formal Dear Sir/Madam for banking / govt in local mode", () => {
    expect(salutationFor({ mode: "local", industry: "Banking" })).toBe("Dear Sir/Madam");
    expect(salutationFor({ mode: "local", industry: "Government" })).toBe("Dear Sir/Madam");
  });

  it("defaults to Dear Hiring Team otherwise", () => {
    expect(salutationFor({})).toBe("Dear Hiring Team");
    expect(salutationFor({ mode: "international" })).toBe("Dear Hiring Team");
  });
});

describe("followUpEmailTemplates", () => {
  it("returns three template variants with correct subjects", () => {
    const templates = followUpEmailTemplates({
      jobTitle: "Backend Engineer",
      companyName: "WSO2",
      name: "Chanuka",
    });
    expect(templates).toHaveLength(3);
    for (const tmpl of templates) {
      expect(tmpl.subject).toContain("Backend Engineer");
      expect(tmpl.body).toContain("WSO2");
      expect(tmpl.body).toContain("Chanuka");
    }
  });

  it("offers polite, value-add, and enthusiasm variants", () => {
    const templates = followUpEmailTemplates({ jobTitle: "X", companyName: "Y", name: "Z" });
    const kinds = templates.map((t) => t.kind).sort();
    expect(kinds).toEqual(["enthusiasm", "polite-check-in", "value-add"]);
  });
});

describe("fillCoverLetterSentence", () => {
  it("substitutes company, role, and industry placeholders", () => {
    const sentence = fillCoverLetterSentence(
      "I admire {company}'s work in {industry} and want to contribute as a {role}.",
      { companyName: "MAS", jobTitle: "Product Manager", industry: "Apparel" },
    );
    expect(sentence).toBe("I admire MAS's work in Apparel and want to contribute as a Product Manager.");
  });

  it("uses sensible defaults when fields are empty", () => {
    const sentence = fillCoverLetterSentence("Joining {company} as a {role}.", {
      companyName: "",
      jobTitle: "",
    });
    expect(sentence).toContain("the company");
    expect(sentence).toContain("the role");
  });
});

describe("suggestSendingWindow", () => {
  it("differs by mode", () => {
    const local = suggestSendingWindow("local");
    const intl = suggestSendingWindow("international");
    expect(local).toContain("SL");
    expect(intl).toContain("international");
    expect(local).not.toEqual(intl);
  });
});
