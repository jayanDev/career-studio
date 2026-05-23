import { scoreResumeText } from "@/lib/ats-scoring";
import { slCompanies, slUniversities } from "@/lib/sl-data";
import type { ResumeContent, ResumeSectionKey } from "@/lib/resume-content";

export type GcvDensity = "compact" | "comfortable" | "spacious";
export type GcvLayout = "one-column" | "two-column" | "sidebar-left" | "sidebar-right" | "canvas";
export type GcvTone = "minimal" | "bold" | "corporate" | "creative" | "formal";
export type GcvVisualMode = "visual" | "ats-safe";
export type GcvPhotoShape = "square" | "circle" | "rounded" | "hexagon";
export type GcvLanguage = "en" | "si" | "ta" | "mixed";

export type GcvBlock = {
  id: string;
  type: ResumeSectionKey | "photo" | "skill-bars" | "language-bars" | "timeline" | "quote" | "portfolio" | "divider" | "icon-row";
  region: "header" | "main" | "sidebar" | "footer";
  label: string;
  enabled: boolean;
  width: "full" | "half" | "third";
  pageBreakBefore?: boolean;
};

export type GcvTheme = {
  accent: string;
  density: GcvDensity;
  template: string;
  palette: string;
  fontPairing: string;
  layout: GcvLayout;
  tone: GcvTone;
  mode: GcvVisualMode;
  language: GcvLanguage;
  paper: "A4" | "Letter";
  photoShape: GcvPhotoShape;
  photoFilter: "none" | "bw" | "sepia" | "bright";
  showPhoto: boolean;
  showLogos: boolean;
  showQr: boolean;
  showPortfolio: boolean;
  showMotif: boolean;
  showBleed: boolean;
  animated: boolean;
  blocks: GcvBlock[];
  portfolioEmbeds: string[];
  sharePassword: string;
  expiresAt: string;
};

export type GcvTemplate = {
  key: string;
  name: string;
  industry: string;
  layout: GcvLayout;
  tone: GcvTone;
  description: string;
  premium?: boolean;
};

export const gcvTemplates: GcvTemplate[] = [
  ...pack("tech", "Tech / Engineering", ["Minimal Stack", "Platform Sidebar", "Monospace Signal", "Cloud Systems"], "minimal", ["one-column", "sidebar-left", "two-column", "sidebar-right"]),
  ...pack("creative", "Design / Creative", ["Bold Portfolio", "Asymmetric Story", "Photo Lead", "Studio Canvas"], "creative", ["canvas", "two-column", "sidebar-left", "canvas"]),
  ...pack("finance", "Finance / Banking", ["Ledger Formal", "Navy Two Column", "Risk & Controls", "Executive Bank"], "corporate", ["two-column", "sidebar-right", "one-column", "sidebar-left"]),
  ...pack("marketing", "Marketing / Sales", ["Growth Metrics", "Brand Builder", "Revenue Motion", "Campaign Cards"], "bold", ["two-column", "sidebar-left", "canvas", "sidebar-right"]),
  ...pack("healthcare", "Healthcare / Medical", ["Clinical Formal", "Credential Focus", "Care Timeline", "Medical Minimal"], "formal", ["one-column", "two-column", "sidebar-right", "one-column"]),
  ...pack("academic", "Academic / Research", ["Publication Heavy", "Research Column", "Conference CV", "Faculty Formal"], "formal", ["one-column", "two-column", "sidebar-left", "one-column"]),
  ...pack("executive", "Executive / Leadership", ["Board Ready", "Whitespace Leader", "Transformation", "Strategic Profile"], "corporate", ["one-column", "sidebar-right", "two-column", "one-column"]),
  ...pack("student", "Entry-level / Student", ["Project First", "Campus Starter", "Internship Visual", "Graduate Formal"], "minimal", ["two-column", "sidebar-left", "canvas", "one-column"]),
  { key: "sl-government", name: "SL Public Sector", industry: "Sri Lanka", layout: "one-column", tone: "formal", description: "A4, strict formal ordering, restrained design." },
  { key: "sl-designer-batik", name: "SL Designer Batik", industry: "Sri Lanka", layout: "sidebar-left", tone: "creative", description: "Subtle local motif accents for creative and tourism roles.", premium: true },
];

export const gcvPalettes = [
  { key: "teal", name: "Corporate Teal", accent: "#0f766e", muted: "#ccfbf1", text: "#111827" },
  { key: "navy", name: "Banking Navy", accent: "#1d4ed8", muted: "#dbeafe", text: "#0f172a" },
  { key: "mono", name: "Monochrome", accent: "#27272a", muted: "#f4f4f5", text: "#18181b" },
  { key: "rose", name: "Creative Rose", accent: "#be123c", muted: "#ffe4e6", text: "#1f2937" },
  { key: "amber", name: "Warm Amber", accent: "#b45309", muted: "#fef3c7", text: "#1f2937" },
  { key: "emerald", name: "SL Emerald", accent: "#047857", muted: "#d1fae5", text: "#111827" },
  { key: "flag", name: "Sri Lankan Flag Accent", accent: "#8d153a", muted: "#ffbe29", text: "#111827" },
  { key: "violet", name: "Portfolio Violet", accent: "#7c3aed", muted: "#ede9fe", text: "#111827" },
  { key: "sky", name: "Tech Sky", accent: "#0284c7", muted: "#e0f2fe", text: "#0f172a" },
  { key: "olive", name: "Earth Olive", accent: "#4d7c0f", muted: "#ecfccb", text: "#1f2937" },
  { key: "slate", name: "Executive Slate", accent: "#475569", muted: "#e2e8f0", text: "#0f172a" },
  { key: "coral", name: "Tourism Coral", accent: "#e11d48", muted: "#ffe4e6", text: "#111827" },
];

export const gcvFontPairings = [
  { key: "inter-source", name: "Inter + Source Sans", heading: "Inter, sans-serif", body: "Source Sans 3, Inter, sans-serif" },
  { key: "playfair-lato", name: "Playfair + Lato", heading: "Playfair Display, Georgia, serif", body: "Lato, Inter, sans-serif" },
  { key: "lora-inter", name: "Lora + Inter", heading: "Lora, Georgia, serif", body: "Inter, sans-serif" },
  { key: "poppins-inter", name: "Poppins + Inter", heading: "Poppins, Inter, sans-serif", body: "Inter, sans-serif" },
  { key: "merriweather-open", name: "Merriweather + Open Sans", heading: "Merriweather, serif", body: "Open Sans, Inter, sans-serif" },
  { key: "mono-tech", name: "IBM Plex Mono + Inter", heading: "IBM Plex Mono, monospace", body: "Inter, sans-serif" },
  { key: "noto-sinhala", name: "Noto Sinhala", heading: "'Noto Sans Sinhala', Inter, sans-serif", body: "'Noto Sans Sinhala', Inter, sans-serif" },
  { key: "noto-tamil", name: "Noto Tamil", heading: "'Noto Sans Tamil', Inter, sans-serif", body: "'Noto Sans Tamil', Inter, sans-serif" },
];

export const defaultGcvBlocks: GcvBlock[] = [
  { id: "header", type: "header", region: "header", label: "Header", enabled: true, width: "full" },
  { id: "photo", type: "photo", region: "sidebar", label: "Photo", enabled: true, width: "full" },
  { id: "summary", type: "summary", region: "main", label: "About", enabled: true, width: "full" },
  { id: "experience", type: "experience", region: "main", label: "Experience", enabled: true, width: "full" },
  { id: "timeline", type: "timeline", region: "main", label: "Timeline", enabled: false, width: "full" },
  { id: "education", type: "education", region: "sidebar", label: "Education", enabled: true, width: "full" },
  { id: "skill-bars", type: "skill-bars", region: "sidebar", label: "Skill bars", enabled: true, width: "full" },
  { id: "skills", type: "skills", region: "sidebar", label: "Skill tags", enabled: true, width: "full" },
  { id: "language-bars", type: "language-bars", region: "sidebar", label: "Language bars", enabled: true, width: "full" },
  { id: "projects", type: "projects", region: "main", label: "Projects", enabled: true, width: "full" },
  { id: "portfolio", type: "portfolio", region: "main", label: "Portfolio embeds", enabled: false, width: "full" },
  { id: "certifications", type: "certifications", region: "sidebar", label: "Certifications", enabled: true, width: "full" },
  { id: "awards", type: "awards", region: "main", label: "Awards", enabled: false, width: "full" },
  { id: "references", type: "references", region: "footer", label: "Referees", enabled: false, width: "full" },
];

export function defaultGcvTheme(seed?: Partial<GcvTheme>): GcvTheme {
  return {
    accent: "teal",
    density: "comfortable",
    template: "tech-minimal-stack",
    palette: "teal",
    fontPairing: "inter-source",
    layout: "sidebar-left",
    tone: "minimal",
    mode: "visual",
    language: "en",
    paper: "A4",
    photoShape: "rounded",
    photoFilter: "none",
    showPhoto: true,
    showLogos: true,
    showQr: true,
    showPortfolio: true,
    showMotif: false,
    showBleed: false,
    animated: false,
    blocks: defaultGcvBlocks,
    portfolioEmbeds: [],
    sharePassword: "",
    expiresAt: "",
    ...seed,
  };
}

export function parseGcvTheme(value: unknown): GcvTheme {
  if (!value || typeof value !== "object") return defaultGcvTheme();
  const record = value as Partial<GcvTheme> & { accent?: string };
  const template = gcvTemplates.find((item) => item.key === record.template);
  const palette = gcvPalettes.find((item) => item.key === (record.palette || record.accent)) ?? gcvPalettes[0];

  return defaultGcvTheme({
    ...record,
    palette: palette.key,
    accent: palette.key,
    template: template?.key ?? record.template ?? "tech-minimal-stack",
    layout: record.layout ?? template?.layout ?? "sidebar-left",
    tone: record.tone ?? template?.tone ?? "minimal",
    blocks: Array.isArray(record.blocks) && record.blocks.length ? mergeBlocks(record.blocks) : defaultGcvBlocks,
  });
}

export function getGcvPalette(theme: GcvTheme) {
  return gcvPalettes.find((palette) => palette.key === theme.palette || palette.key === theme.accent) ?? gcvPalettes[0];
}

export function getGcvFonts(theme: GcvTheme) {
  return gcvFontPairings.find((font) => font.key === theme.fontPairing) ?? gcvFontPairings[0];
}

export function applyGcvModeToContent(content: ResumeContent, theme: GcvTheme): ResumeContent {
  const palette = getGcvPalette(theme);
  const isAtsSafe = theme.mode === "ats-safe";
  return {
    ...content,
    mode: theme.paper === "A4" ? "local" : content.mode,
    settings: {
      ...content.settings,
      accentColor: palette.accent,
      exportFormat: isAtsSafe ? "ats-friendly" : "pixel-perfect",
      includePhoto: !isAtsSafe && theme.showPhoto,
      showSkillRatings: !isAtsSafe,
      hideReferences: !theme.blocks.some((block) => block.type === "references" && block.enabled),
      displayLanguage: theme.language === "si" ? "si" : theme.language === "ta" ? "ta" : "en",
      font: theme.language === "si" ? "noto-sinhala" : theme.language === "ta" ? "noto-tamil" : content.settings?.font ?? "inter",
    },
  };
}

export function analyzeGcvDesign(content: ResumeContent, theme: GcvTheme) {
  const ats = scoreResumeText(JSON.stringify(content), "");
  const enabledBlocks = theme.blocks.filter((block) => block.enabled);
  const issues = [
    theme.mode === "visual" && ats.overall < 65 ? "Visual mode may be weak for ATS portals. Export ATS-safe for online forms." : "",
    enabledBlocks.length > 10 ? "The design is crowded. Disable two optional blocks or switch to compact density." : "",
    theme.showPhoto && !content.header.photoUrl ? "Photo block is enabled, but no photo URL is set." : "",
    theme.showPortfolio && !theme.portfolioEmbeds.length ? "Portfolio block is enabled without portfolio links." : "",
    content.mode === "international" && content.header.nic ? "NIC should stay hidden for international versions." : "",
    theme.palette === "flag" ? "Sri Lankan flag accent is best kept subtle for corporate roles." : "",
  ].filter(Boolean);

  return {
    atsScore: theme.mode === "ats-safe" ? Math.max(ats.overall, 78) : Math.max(35, ats.overall - 15),
    pageCountEstimate: Math.max(1, Math.ceil((content.experience.length + content.projects.length + enabledBlocks.length) / 8)),
    issues,
    suggestions: [
      content.projects.length ? "Project-heavy profile: keep Projects in the main column." : "Add 1-2 portfolio/project links for stronger visual impact.",
      content.experience.length > 3 ? "Experience-heavy profile: use Executive or Publication-heavy layouts with two pages." : "Compact one-page layout is feasible.",
      theme.language !== "en" ? "Noto Sinhala/Tamil font fallback is enabled for local-language rendering." : "Use mixed-language mode for SL government or NGO applications when needed.",
    ],
  };
}

export function knownLogoLabel(name: string) {
  const company = slCompanies.find((item) => sameName(item, name));
  const university = slUniversities.find((item) => sameName(item, name));
  const label = company || university;
  if (!label) return "";
  return label.split(/\s+/).map((part) => part[0]).join("").slice(0, 4).toUpperCase();
}

function pack(industry: string, label: string, names: string[], tone: GcvTone, layouts: GcvLayout[]) {
  return names.map((name, index) => ({
    key: `${industry}-${slug(name)}`,
    name,
    industry: label,
    layout: layouts[index % layouts.length],
    tone,
    description: `${label} template with ${layouts[index % layouts.length].replace("-", " ")} layout.`,
  }));
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sameName(left: string, right: string) {
  return Boolean(left && right && (left.toLowerCase().includes(right.toLowerCase()) || right.toLowerCase().includes(left.toLowerCase())));
}

function mergeBlocks(blocks: GcvBlock[]) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return defaultGcvBlocks.map((block) => ({ ...block, ...byId.get(block.id) }));
}
