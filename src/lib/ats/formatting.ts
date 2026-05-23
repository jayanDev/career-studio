/**
 * Formatting-hazard detection — the things that quietly break ATS parsers.
 *
 * We classify hazards into:
 *   - critical : will almost certainly corrupt the parse (e.g. multi-column)
 *   - major    : commonly drops or garbles fields (tables, header/footer)
 *   - minor    : cosmetic / mild impact (emoji bullets, special chars)
 *
 * The output reports per-hazard {key, severity, message, evidence} so the
 * UI can render an actionable list. The total deduction is applied to the
 * Format sub-score (capped at -25).
 */

import type { ExtractedResume } from "@/lib/ats/extract";

export type HazardSeverity = "critical" | "major" | "minor";

export type FormattingHazard = {
  key: string;
  severity: HazardSeverity;
  message: string;
  evidence?: string;
  /** Negative penalty applied to the Format sub-score for this hazard. */
  penalty: number;
};

export type FormattingReport = {
  hazards: FormattingHazard[];
  formatPenalty: number;
  totalPenalty: number;
  warnings: string[];
};

// Emoji / pictograph / dingbat ranges. Excludes ASCII bullets handled separately.
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/u;
const NON_STANDARD_BULLET = /[★☆◆◇■□▪▫►▸◀◁✓✔✗✘]/;
const SPECIAL_LINE_DRAWING = /[│┃─━┄┅┈┉╌╍═║]/;

export function detectFormattingHazards(extracted: ExtractedResume): FormattingReport {
  const hazards: FormattingHazard[] = [];
  const text = extracted.text;

  // 1. Multi-column / table-like layout. Detected during extraction.
  if (extracted.hasTables) {
    hazards.push({
      key: "tables_or_columns",
      severity: "critical",
      message:
        "Tables or multi-column layout detected. Most ATS parsers will read columns left-to-right across rows, mangling the order of your information.",
      penalty: -8,
    });
  }

  // 2. Embedded images. ATS strips them and any text inside them is lost.
  if (extracted.hasImages) {
    hazards.push({
      key: "embedded_images",
      severity: "major",
      message:
        "Embedded images detected. Any text inside images (logos, charts, icon labels) will not be read by the ATS.",
      penalty: -4,
    });
  }

  // 3. Content in page headers/footers. (Heuristic flagged by parser.)
  if (extracted.hasHeaderFooter) {
    hazards.push({
      key: "header_footer_content",
      severity: "major",
      message:
        "Important content sits in page headers/footers. Many ATS parsers drop these regions entirely.",
      penalty: -4,
    });
  }

  // 4. Non-standard bullet glyphs (★, ✓, ►).
  const fancyBulletCount = (text.match(new RegExp(NON_STANDARD_BULLET, "g")) ?? []).length;
  if (fancyBulletCount >= 3) {
    hazards.push({
      key: "non_standard_bullets",
      severity: "minor",
      message: `Non-standard bullet glyphs found (${fancyBulletCount}). Use plain "•" or "-" for best parser compatibility.`,
      evidence: text.match(NON_STANDARD_BULLET)?.[0],
      penalty: -2,
    });
  }

  // 5. Emoji / pictographs. These survive UTF-8 but break some recruiter views.
  if (EMOJI_RE.test(text)) {
    hazards.push({
      key: "emoji_in_content",
      severity: "minor",
      message: "Emoji detected in the resume body. Recruiter ATS exports may render them as boxes.",
      evidence: text.match(EMOJI_RE)?.[0],
      penalty: -1,
    });
  }

  // 6. Line-drawing characters (used for visual separators, often confuse parsers).
  if (SPECIAL_LINE_DRAWING.test(text)) {
    hazards.push({
      key: "line_drawing",
      severity: "minor",
      message: "Box / line-drawing characters detected — replace with plain text separators.",
      penalty: -1,
    });
  }

  // 7. Excessive pipe-separated layouts (proxy for a table-as-text).
  const pipeCount = (text.match(/\|/g) ?? []).length;
  if (pipeCount > 20) {
    hazards.push({
      key: "pipe_table",
      severity: "major",
      message: `Pipe-separated layout detected (${pipeCount} pipes). This typically indicates a table that the ATS cannot read row-by-row.`,
      penalty: -3,
    });
  }

  // 8. Excessive non-ASCII outside emoji (e.g. ligatures, smart quotes).
  const nonAsciiMatches = text.match(/[^\x00-\x7F]/g) ?? [];
  const nonEmojiNonAscii = nonAsciiMatches.filter((c) => !EMOJI_RE.test(c)).length;
  if (nonEmojiNonAscii > 30) {
    hazards.push({
      key: "smart_quotes",
      severity: "minor",
      message: "Many smart quotes / unicode ligatures detected — convert to plain ASCII for safer parsing.",
      penalty: -1,
    });
  }

  // 9. Page-count warning: > 3 pages is a recruiter signal even if ATS parses fine.
  if (extracted.pageCount && extracted.pageCount > 3) {
    hazards.push({
      key: "long_document",
      severity: "minor",
      message: `Document is ${extracted.pageCount} pages. Recruiters typically expect 1–2 pages for non-academic roles.`,
      penalty: -1,
    });
  }

  // 10. Lossy fallback extraction → format integrity is unknown.
  if (extracted.source === "buffer") {
    hazards.push({
      key: "lossy_extraction",
      severity: "critical",
      message:
        "We could not parse the file structurally and fell back to plain bytes. The ATS will see roughly the same garbled output — re-export from Word as PDF.",
      penalty: -6,
    });
  }

  const totalPenalty = hazards.reduce((acc, h) => acc + h.penalty, 0);
  // Cap so Format never goes below 0; the caller will Math.max(0, ...) too.
  const formatPenalty = Math.max(-25, totalPenalty);

  return {
    hazards,
    formatPenalty,
    totalPenalty,
    warnings: extracted.warnings,
  };
}
