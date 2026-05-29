import { describe, expect, it } from "vitest";

import { parseResumeHeuristic, type ParseConfidence } from "@/lib/ats/parse-sections";

// parseResumeHeuristic is a pure, regex-driven parser — no API key, no network.
// We feed it a realistic plain-text CV and assert the structured extraction.

const RESUME = [
  "Jane Perera",
  "Colombo, Sri Lanka",
  "jane.perera@example.com | +94 71 234 5678",
  "linkedin.com/in/janeperera | github.com/janeperera",
  "",
  "Summary",
  "Senior software engineer with 8 years building scalable web platforms across fintech and e-commerce in Sri Lanka.",
  "",
  "Experience",
  "Senior Engineer at TechCorp 2020 - present",
  "• Increased throughput by 40% across 3 regions",
  "• Led a team of 6 engineers building payment systems",
  "Software Engineer at StartupX 2017 - 2020",
  "• Built and shipped the customer onboarding flow",
  "",
  "Education",
  "BSc in Computer Science",
  "University of Colombo",
  "2013 - 2017",
  "GPA: 3.8 / 4.0",
  "",
  "Skills",
  "JavaScript, TypeScript, React, Node.js, PostgreSQL, AWS, Docker",
  "",
  "Certifications",
  "AWS Certified Solutions Architect",
  "Google Cloud Professional",
  "",
  "Projects",
  "Open source resume parser",
  "",
  "Languages",
  "English, Sinhala, Tamil",
].join("\n");

describe("parseResumeHeuristic — contact block", () => {
  const { parsed } = parseResumeHeuristic(RESUME);

  it("pulls the name from the first plain line", () => {
    expect(parsed.contact.name).toBe("Jane Perera");
  });

  it("extracts email, phone, linkedin and github", () => {
    expect(parsed.contact.email).toBe("jane.perera@example.com");
    expect(parsed.contact.phone).toBeTruthy();
    expect(parsed.contact.linkedin).toContain("linkedin.com/in/janeperera");
    expect(parsed.contact.github).toContain("github.com/janeperera");
  });

  it("detects a 'City, Region' location", () => {
    expect(parsed.contact.location).toContain("Colombo");
  });

  it("leaves website null when no bare http(s) URL is present", () => {
    expect(parsed.contact.website).toBeNull();
  });
});

describe("parseResumeHeuristic — sections", () => {
  const { parsed } = parseResumeHeuristic(RESUME);

  it("captures the summary text", () => {
    expect(parsed.summary).toContain("Senior software engineer with 8 years");
  });

  it("splits experience into two roles with bullets and dates", () => {
    expect(parsed.experience).toHaveLength(2);
    const [first, second] = parsed.experience;
    expect(first.title).toBe("Senior Engineer");
    expect(first.company).toContain("TechCorp");
    expect(first.bullets).toHaveLength(2);
    expect(first.start_date).toContain("2020");
    expect(first.end_date).toMatch(/present/i);
    expect(second.title).toBe("Software Engineer");
  });

  it("extracts at least one education entry and a GPA", () => {
    expect(parsed.education.length).toBeGreaterThanOrEqual(1);
    expect(parsed.education[0].degree).toBe("BSc in Computer Science");
    expect(parsed.education.some((e) => e.gpa?.includes("3.8"))).toBe(true);
  });

  it("splits the skills line on commas and dedupes", () => {
    expect(parsed.skills).toHaveLength(7);
    expect(parsed.skills).toContain("JavaScript");
    expect(parsed.skills).toContain("React");
    expect(parsed.skills).toContain("Docker");
  });

  it("reads certifications as one entry per line", () => {
    expect(parsed.certifications).toEqual([
      "AWS Certified Solutions Architect",
      "Google Cloud Professional",
    ]);
  });

  it("maps each project line into a project object", () => {
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0].name).toBe("Open source resume parser");
    expect(parsed.projects[0].bullets).toEqual([]);
  });

  it("captures the languages line", () => {
    expect(parsed.languages.join(" ")).toContain("Sinhala");
  });
});

describe("parseResumeHeuristic — confidence & method", () => {
  it("rates a complete resume 'high' across every section", () => {
    const { confidence, method } = parseResumeHeuristic(RESUME);
    expect(method).toBe("heuristic");
    const expected: ParseConfidence = {
      contact: "high",
      summary: "high",
      experience: "high",
      education: "high",
      skills: "high",
      certifications: "high",
      projects: "high",
      languages: "high",
    };
    expect(confidence).toEqual(expected);
  });

  it("marks everything 'missing' for empty input", () => {
    const { parsed, confidence } = parseResumeHeuristic("");
    expect(parsed.experience).toEqual([]);
    expect(parsed.skills).toEqual([]);
    expect(parsed.contact.name).toBeNull();
    for (const level of Object.values(confidence)) expect(level).toBe("missing");
  });

  it("downgrades partial contact and a short summary to 'medium'", () => {
    const text = ["John", "john@example.com", "", "Summary", "Short bio."].join("\n");
    const { confidence } = parseResumeHeuristic(text);
    expect(confidence.contact).toBe("medium"); // name + email only
    expect(confidence.summary).toBe("medium"); // present but < 50 chars
    expect(confidence.experience).toBe("missing");
  });
});
