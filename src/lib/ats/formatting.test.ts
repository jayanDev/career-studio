import { describe, expect, it } from "vitest";

import type { ExtractedResume } from "@/lib/ats/extract";
import { detectFormattingHazards } from "@/lib/ats/formatting";

/** Minimal ExtractedResume; override only the fields a test exercises. */
function makeExtracted(overrides: Partial<ExtractedResume> = {}): ExtractedResume {
  return { text: "", wordCount: 0, source: "pdf", warnings: [], ...overrides };
}

function keys(extracted: ExtractedResume): string[] {
  return detectFormattingHazards(extracted).hazards.map((h) => h.key);
}

describe("detectFormattingHazards — clean input", () => {
  it("reports no hazards for a plain ASCII resume", () => {
    const report = detectFormattingHazards(
      makeExtracted({ text: "Jane Doe\nSoftware Engineer\n- Built things\n- Shipped them" }),
    );
    expect(report.hazards).toHaveLength(0);
    expect(report.formatPenalty).toBe(0);
    expect(report.totalPenalty).toBe(0);
  });

  it("passes the extractor's warnings through unchanged", () => {
    const report = detectFormattingHazards(makeExtracted({ warnings: ["lossy fallback"] }));
    expect(report.warnings).toEqual(["lossy fallback"]);
  });
});

describe("detectFormattingHazards — structural flags from extraction", () => {
  it("flags tables/columns as critical (-8)", () => {
    const report = detectFormattingHazards(makeExtracted({ hasTables: true }));
    expect(report.hazards).toHaveLength(1);
    expect(report.hazards[0]).toMatchObject({
      key: "tables_or_columns",
      severity: "critical",
      penalty: -8,
    });
    expect(report.formatPenalty).toBe(-8);
  });

  it("flags embedded images as major (-4)", () => {
    const report = detectFormattingHazards(makeExtracted({ hasImages: true }));
    expect(keys(makeExtracted({ hasImages: true }))).toEqual(["embedded_images"]);
    expect(report.hazards[0].severity).toBe("major");
    expect(report.formatPenalty).toBe(-4);
  });

  it("flags header/footer content as major (-4)", () => {
    expect(keys(makeExtracted({ hasHeaderFooter: true }))).toEqual(["header_footer_content"]);
  });

  it("flags a buffer (lossy) extraction as critical (-6)", () => {
    const report = detectFormattingHazards(makeExtracted({ source: "buffer" }));
    expect(report.hazards[0]).toMatchObject({ key: "lossy_extraction", penalty: -6 });
  });

  it("flags long documents (>3 pages) as minor (-1)", () => {
    expect(keys(makeExtracted({ pageCount: 5 }))).toEqual(["long_document"]);
    expect(keys(makeExtracted({ pageCount: 2 }))).toEqual([]);
  });
});

describe("detectFormattingHazards — glyph heuristics", () => {
  it("flags >= 3 non-standard bullet glyphs with evidence", () => {
    const report = detectFormattingHazards(makeExtracted({ text: "◆ one\n◆ two\n◆ three" }));
    const hazard = report.hazards.find((h) => h.key === "non_standard_bullets");
    expect(hazard).toBeDefined();
    expect(hazard?.penalty).toBe(-2);
    expect(hazard?.evidence).toBe("◆");
  });

  it("does not flag fewer than 3 fancy bullets", () => {
    expect(keys(makeExtracted({ text: "◆ one\n◆ two" }))).toEqual([]);
  });

  it("flags emoji in the body as minor (-1)", () => {
    const report = detectFormattingHazards(makeExtracted({ text: "Launched 🚀 the product" }));
    expect(report.hazards.map((h) => h.key)).toContain("emoji_in_content");
  });

  it("flags line-drawing characters", () => {
    expect(keys(makeExtracted({ text: "Experience │ 2020" }))).toContain("line_drawing");
  });

  it("flags a pipe-heavy (>20) layout as major", () => {
    const report = detectFormattingHazards(makeExtracted({ text: "|".repeat(21) }));
    expect(report.hazards.find((h) => h.key === "pipe_table")?.penalty).toBe(-3);
  });

  it("flags excessive smart quotes / ligatures (>30)", () => {
    expect(keys(makeExtracted({ text: "“".repeat(31) }))).toContain("smart_quotes");
    expect(keys(makeExtracted({ text: "“".repeat(10) }))).toEqual([]);
  });
});

describe("detectFormattingHazards — penalty cap", () => {
  it("caps formatPenalty at -25 while totalPenalty reflects the true sum", () => {
    const report = detectFormattingHazards(
      makeExtracted({
        text: "◆◆◆🚀│" + "“".repeat(31) + "|".repeat(21),
        hasTables: true,
        hasImages: true,
        hasHeaderFooter: true,
        pageCount: 5,
        source: "buffer",
      }),
    );
    // tables -8, images -4, header/footer -4, bullets -2, emoji -1, line -1,
    // pipe -3, smart quotes -1, long doc -1, lossy -6  => -31
    expect(report.hazards).toHaveLength(10);
    expect(report.totalPenalty).toBe(-31);
    expect(report.formatPenalty).toBe(-25);
  });
});
