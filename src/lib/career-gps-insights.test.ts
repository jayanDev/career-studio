import { describe, expect, it } from "vitest";

import { planStrengthLabel } from "./career-gps-insights";

describe("planStrengthLabel", () => {
  it("returns 'Roadmap is concrete and actionable' for 90+", () => {
    expect(planStrengthLabel(100)).toBe("Roadmap is concrete and actionable");
    expect(planStrengthLabel(95)).toBe("Roadmap is concrete and actionable");
    expect(planStrengthLabel(90)).toBe("Roadmap is concrete and actionable");
  });

  it("returns the 'Strong direction' label for 75-89", () => {
    expect(planStrengthLabel(89)).toBe(
      "Strong direction, some week-level detail still missing",
    );
    expect(planStrengthLabel(80)).toBe(
      "Strong direction, some week-level detail still missing",
    );
    expect(planStrengthLabel(75)).toBe(
      "Strong direction, some week-level detail still missing",
    );
  });

  it("returns the 'Direction set' label for 60-74", () => {
    expect(planStrengthLabel(74)).toBe("Direction set, week-level tasks need refinement");
    expect(planStrengthLabel(65)).toBe("Direction set, week-level tasks need refinement");
    expect(planStrengthLabel(60)).toBe("Direction set, week-level tasks need refinement");
  });

  it("returns the 'Try adding more detail' label for <60", () => {
    expect(planStrengthLabel(59)).toBe("Try adding more detail about your background");
    expect(planStrengthLabel(30)).toBe("Try adding more detail about your background");
    expect(planStrengthLabel(0)).toBe("Try adding more detail about your background");
  });
});
