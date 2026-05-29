import { describe, expect, it } from "vitest";

import {
  dedupeSkills,
  isSameSkill,
  normaliseSkill,
  resumeMentionsSkill,
} from "@/lib/ats/skill-taxonomy";

describe("normaliseSkill", () => {
  it("maps known aliases to their canonical form", () => {
    expect(normaliseSkill("JS")).toBe("JavaScript");
    expect(normaliseSkill("ES6")).toBe("JavaScript");
    expect(normaliseSkill("K8s")).toBe("Kubernetes");
    expect(normaliseSkill("AWS")).toBe("Amazon Web Services");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normaliseSkill("  ts  ")).toBe("TypeScript");
    expect(normaliseSkill("nodejs")).toBe("Node.js");
  });

  it("returns the trimmed input unchanged when no mapping exists", () => {
    expect(normaliseSkill("Rust")).toBe("Rust");
    expect(normaliseSkill("  Elixir ")).toBe("Elixir");
  });

  it("maps a canonical name to itself", () => {
    expect(normaliseSkill("JavaScript")).toBe("JavaScript");
  });
});

describe("isSameSkill", () => {
  it("treats synonyms as the same skill", () => {
    expect(isSameSkill("JS", "JavaScript")).toBe(true);
    expect(isSameSkill("k8s", "Kubernetes")).toBe(true);
    expect(isSameSkill("Postgres", "PostgreSQL")).toBe(true);
  });

  it("distinguishes genuinely different skills", () => {
    expect(isSameSkill("Vue", "React")).toBe(false);
    expect(isSameSkill("Python", "Go")).toBe(false);
  });

  it("compares case-insensitively", () => {
    expect(isSameSkill("javascript", "JAVASCRIPT")).toBe(true);
  });
});

describe("dedupeSkills", () => {
  it("collapses synonyms to a single canonical entry, first-seen order preserved", () => {
    expect(dedupeSkills(["JS", "JavaScript", "ES6", "React", "react"])).toEqual([
      "JavaScript",
      "React",
    ]);
  });

  it("keeps unknown skills as-is", () => {
    expect(dedupeSkills(["Python", "Rust", "Py"])).toEqual(["Python", "Rust"]);
  });

  it("returns an empty array for empty input", () => {
    expect(dedupeSkills([])).toEqual([]);
  });
});

describe("resumeMentionsSkill", () => {
  it("matches on the canonical spelling", () => {
    expect(resumeMentionsSkill("experienced in javascript and css", "JS")).toBe(true);
  });

  it("matches when only an alias appears in the resume", () => {
    // Resume says "k8s"; JD keyword is the canonical "Kubernetes".
    expect(resumeMentionsSkill("we use k8s for orchestration", "Kubernetes")).toBe(true);
  });

  it("returns false when neither canonical nor any alias is present", () => {
    expect(resumeMentionsSkill("a java backend developer", "Golang")).toBe(false);
  });
});
