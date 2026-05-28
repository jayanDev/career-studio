import { describe, expect, it } from "vitest";

import { maskList, maskLocation, maskName, maskText, REDACTION_PLACEHOLDER } from "./share-mask";

describe("maskText", () => {
  it("redacts emails", () => {
    expect(maskText("Contact me at jane.smith@example.com please.")).toBe(
      `Contact me at ${REDACTION_PLACEHOLDER} please.`,
    );
  });

  it("redacts Sri Lankan NIC (old format)", () => {
    expect(maskText("NIC: 853491234V on file")).toBe(`NIC: ${REDACTION_PLACEHOLDER} on file`);
  });

  it("redacts Sri Lankan NIC (new 12-digit format)", () => {
    expect(maskText("ID 200012345678 was issued")).toBe(`ID ${REDACTION_PLACEHOLDER} was issued`);
  });

  it("redacts phone numbers including LK format", () => {
    expect(maskText("Call +94 77 123 4567 today")).toContain(REDACTION_PLACEHOLDER);
    expect(maskText("Call 0771234567 today")).toContain(REDACTION_PLACEHOLDER);
  });

  it("redacts URLs", () => {
    expect(maskText("See https://linkedin.com/in/jane for more")).toBe(
      `See ${REDACTION_PLACEHOLDER} for more`,
    );
    expect(maskText("Visit github.com/jane today")).toBe(
      `Visit ${REDACTION_PLACEHOLDER} today`,
    );
  });

  it("handles empty / null inputs without throwing", () => {
    expect(maskText("")).toBe("");
  });
});

describe("maskName", () => {
  it("returns 'Anonymous candidate' for null/empty", () => {
    expect(maskName(null)).toBe("Anonymous candidate");
    expect(maskName("")).toBe("Anonymous candidate");
    expect(maskName("   ")).toBe("Anonymous candidate");
  });

  it("returns first initial in a privacy-preserving form", () => {
    expect(maskName("Jane Doe")).toBe("Candidate (J.)");
    expect(maskName("anil perera")).toBe("Candidate (A.)");
  });
});

describe("maskLocation", () => {
  it("keeps country if 'City, Country' format", () => {
    expect(maskLocation("Colombo, Sri Lanka")).toBe("Sri Lanka");
    expect(maskLocation("San Francisco, CA, USA")).toBe("USA");
  });

  it("hides anything else", () => {
    expect(maskLocation("123 Main Street")).toBeNull();
    expect(maskLocation("")).toBeNull();
    expect(maskLocation(null)).toBeNull();
  });
});

describe("maskList", () => {
  it("masks every string in an array", () => {
    const result = maskList(["email john@x.com", "phone +94771234567"]);
    expect(result.every((s) => s.includes(REDACTION_PLACEHOLDER))).toBe(true);
  });

  it("returns [] for null/undefined", () => {
    expect(maskList(null)).toEqual([]);
    expect(maskList(undefined)).toEqual([]);
  });
});
