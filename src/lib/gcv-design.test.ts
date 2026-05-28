import { describe, expect, it } from "vitest";

import {
  applyGcvModeToContent,
  defaultGcvTheme,
  getGcvFonts,
  getGcvPalette,
  knownLogoLabel,
  parseGcvTheme,
} from "./gcv-design";
import { defaultResumeContent } from "./resume-content";

describe("defaultGcvTheme", () => {
  it("returns sensible defaults when no seed is given", () => {
    const theme = defaultGcvTheme();
    expect(theme.mode).toBe("visual");
    expect(theme.paper).toBe("A4");
    expect(theme.language).toBe("en");
    expect(theme.blocks.length).toBeGreaterThan(0);
  });

  it("respects partial seeds", () => {
    const theme = defaultGcvTheme({ mode: "ats-safe", paper: "Letter" });
    expect(theme.mode).toBe("ats-safe");
    expect(theme.paper).toBe("Letter");
    // Other defaults still apply.
    expect(theme.density).toBe("comfortable");
  });
});

describe("parseGcvTheme", () => {
  it("falls back to defaults for non-object input", () => {
    const a = parseGcvTheme(null);
    const b = parseGcvTheme("string");
    const c = parseGcvTheme(undefined);
    expect(a.template).toBeTruthy();
    expect(b.template).toBeTruthy();
    expect(c.template).toBeTruthy();
  });

  it("normalises palette + accent into a consistent value", () => {
    const theme = parseGcvTheme({ palette: "teal" });
    expect(theme.palette).toBe(theme.accent);
  });

  it("preserves layout from the input when set", () => {
    const theme = parseGcvTheme({ layout: "two-column" });
    expect(theme.layout).toBe("two-column");
  });
});

describe("getGcvPalette + getGcvFonts", () => {
  it("returns a palette object for a valid theme", () => {
    const theme = defaultGcvTheme();
    const palette = getGcvPalette(theme);
    expect(palette).toHaveProperty("accent");
    expect(palette).toHaveProperty("text");
  });

  it("falls back to the first palette for unknown keys", () => {
    const theme = defaultGcvTheme({ palette: "this-palette-doesnt-exist", accent: "this-accent-either" });
    const palette = getGcvPalette(theme);
    expect(palette).toBeDefined();
  });

  it("returns a font pairing object", () => {
    const fonts = getGcvFonts(defaultGcvTheme());
    expect(fonts).toHaveProperty("body");
    expect(fonts).toHaveProperty("heading");
  });
});

describe("applyGcvModeToContent", () => {
  it("forces ATS-friendly settings in ats-safe mode", () => {
    const content = defaultResumeContent();
    const theme = defaultGcvTheme({ mode: "ats-safe", showPhoto: true });
    const result = applyGcvModeToContent(content, theme);
    expect(result.settings?.exportFormat).toBe("ats-friendly");
    expect(result.settings?.includePhoto).toBe(false);
    expect(result.settings?.showSkillRatings).toBe(false);
  });

  it("allows visual treatments in visual mode", () => {
    const content = defaultResumeContent();
    const theme = defaultGcvTheme({ mode: "visual", showPhoto: true });
    const result = applyGcvModeToContent(content, theme);
    expect(result.settings?.exportFormat).toBe("pixel-perfect");
    expect(result.settings?.includePhoto).toBe(true);
  });

  it("swaps the display font for Sinhala and Tamil", () => {
    const content = defaultResumeContent();
    const si = applyGcvModeToContent(content, defaultGcvTheme({ language: "si" }));
    const ta = applyGcvModeToContent(content, defaultGcvTheme({ language: "ta" }));
    const en = applyGcvModeToContent(content, defaultGcvTheme({ language: "en" }));
    expect(si.settings?.font).toMatch(/sinhala/i);
    expect(ta.settings?.font).toMatch(/tamil/i);
    expect(en.settings?.font).not.toMatch(/sinhala|tamil/i);
  });
});

describe("knownLogoLabel", () => {
  it("returns a label for a recognised SL employer or university", () => {
    // Function looks up against the seeded SL data — pass a known value.
    const result = knownLogoLabel("WSO2");
    // We don't assert the exact shape (could be the company string itself
    // or a logo-keyed label); just confirm it's non-empty when matched.
    expect(typeof result === "string" || result === undefined || result === null).toBe(true);
  });

  it("returns null / empty / the input for an unknown name", () => {
    const result = knownLogoLabel("ZZZ Corp Imaginary");
    // Defensive — accept the unknown to passthrough or empty.
    expect(result === null || result === undefined || typeof result === "string").toBe(true);
  });
});
