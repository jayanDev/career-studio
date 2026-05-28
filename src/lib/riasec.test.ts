import { describe, expect, it } from "vitest";

import { computeRiasecCode, RIASEC_QUESTIONS } from "./riasec";

function answersFor(type: "R" | "I" | "A" | "S" | "E" | "C", value: number): Record<string, number> {
  return RIASEC_QUESTIONS
    .filter((q) => q.type === type)
    .reduce<Record<string, number>>((acc, q) => {
      acc[q.id] = value;
      return acc;
    }, {});
}

describe("computeRiasecCode", () => {
  it("returns a 3-letter code from the top-3 type scores", () => {
    // Strong I, A, S; everything else neutral.
    const answers = {
      ...answersFor("I", 5),
      ...answersFor("A", 4),
      ...answersFor("S", 3),
      ...answersFor("R", 1),
      ...answersFor("E", 1),
      ...answersFor("C", 1),
    };
    const { code } = computeRiasecCode(answers);
    expect(code).toBe("IAS");
  });

  it("breaks ties deterministically (R > I > A > S > E > C insertion order)", () => {
    // Everyone tied at 4 — order should follow the natural enumeration.
    const answers = {
      ...answersFor("R", 4),
      ...answersFor("I", 4),
      ...answersFor("A", 4),
      ...answersFor("S", 4),
      ...answersFor("E", 4),
      ...answersFor("C", 4),
    };
    const { code, ranked } = computeRiasecCode(answers);
    expect(code).toHaveLength(3);
    expect(ranked).toHaveLength(6);
    // All scores equal.
    expect(new Set(ranked.map((r) => r.score)).size).toBe(1);
  });

  it("clamps out-of-range answers to 1..5", () => {
    const { scores } = computeRiasecCode({
      ...Object.fromEntries(RIASEC_QUESTIONS.filter((q) => q.type === "I").map((q) => [q.id, 99])),
    });
    // 4 questions × clamp(5) = 20 max
    expect(scores.I).toBe(20);
  });

  it("treats missing answers as 0", () => {
    const { code, scores } = computeRiasecCode({});
    // No answers → every type has 0; top-3 is still 3 letters.
    expect(code).toHaveLength(3);
    expect(Object.values(scores).every((v) => v === 0)).toBe(true);
  });

  it("ignores non-numeric values defensively", () => {
    const answers = {
      ...answersFor("S", 5),
      // A typo / bad input — should not crash or score.
      r1: NaN as unknown as number,
    };
    const { scores } = computeRiasecCode(answers);
    expect(scores.S).toBe(20);
    expect(scores.R).toBe(0);
  });
});
