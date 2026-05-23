/**
 * Bullet-level analysis (Resume Worded / VMock style).
 *
 * Operates on the parsed experience section. For each bullet we produce:
 *   - actionVerb       : strong action opener? ("Built X" vs "Responsible for X")
 *   - quantified       : contains a number, %, $, or "X+"?
 *   - xyzFormat        : looks like "Did X by doing Y, resulting in Z"?
 *   - length           : 8-20 words is the sweet spot.
 *   - tense            : present for current roles, past for past roles.
 *
 * Rolled up to an "Impact score" 0-100 across all bullets. The impact score
 * does NOT affect the overall ATS score directly (Content already covers
 * skills/sections); it lives alongside as a writing-quality signal.
 */

import type { ParsedResume } from "@/lib/ats/parse-sections";

export type BulletFlag = "action_verb" | "weak_opener" | "quantified" | "xyz" | "ideal_length" | "too_short" | "too_long" | "tense_mismatch" | "first_person";

export type BulletAnalysis = {
  text: string;
  wordCount: number;
  flags: BulletFlag[];
  score: number; // 0-100 per-bullet
};

export type RoleBulletReport = {
  title: string;
  company: string;
  isCurrent: boolean;
  bullets: BulletAnalysis[];
  averageScore: number;
};

export type BulletReport = {
  roles: RoleBulletReport[];
  overallImpactScore: number;
  totalBullets: number;
  topIssues: string[];
};

/* Strong action verbs (lowercase). Curated to ~120 to give better coverage
   than the 15 in the legacy scorer. */
const STRONG_VERBS = new Set([
  "accelerated", "achieved", "acquired", "advanced", "analysed", "analyzed", "architected", "automated", "boosted", "built",
  "captured", "centralised", "championed", "closed", "coached", "collaborated", "consolidated", "constructed", "converted",
  "coordinated", "created", "cultivated", "cut", "decreased", "delivered", "deployed", "designed", "developed", "directed",
  "doubled", "drove", "earned", "eliminated", "engineered", "enhanced", "established", "exceeded", "executed", "expanded",
  "expedited", "facilitated", "formulated", "founded", "generated", "grew", "headed", "implemented", "improved", "increased",
  "initiated", "innovated", "instituted", "integrated", "introduced", "launched", "led", "leveraged", "managed", "maximised",
  "maximized", "mentored", "migrated", "modernised", "modernized", "negotiated", "optimised", "optimized", "orchestrated",
  "originated", "outperformed", "overhauled", "owned", "partnered", "piloted", "pioneered", "produced", "programmed",
  "raised", "rebuilt", "redesigned", "reduced", "refactored", "released", "rolled", "saved", "scaled", "secured",
  "shipped", "simplified", "slashed", "solved", "spearheaded", "standardised", "standardized", "steered", "streamlined",
  "strengthened", "structured", "supervised", "surpassed", "synthesised", "transformed", "tripled", "unified", "upgraded",
  "validated", "won", "wrote",
]);

const WEAK_OPENERS = [
  /^responsible for\b/i,
  /^duties (included|were)\b/i,
  /^helped (with|to)\b/i,
  /^worked on\b/i,
  /^assisted (with|in)\b/i,
  /^tasked with\b/i,
  /^involved in\b/i,
  /^participated in\b/i,
  /^took part in\b/i,
  /^was (responsible|in charge|tasked|involved)\b/i,
];

const FIRST_PERSON = /\b(i|me|my|mine|myself|we|us|our|ours)\b/i;

const QUANT = /(\d+\s*%|\d+[+]|\$\s*\d|\d+(?:,\d{3})+|\b\d+(?:\.\d+)?\s*(k|m|million|thousand|users|customers|hours|days|weeks|months|years|tickets|leads|reports|projects|teams|engineers|countries|regions|markets|x))/i;

const PAST_TENSE = /\b(ed|built|led|grew|drove|won|wrote|cut|made|sold|ran|set|saw)\b/i;
const PRESENT_TENSE = /\b(am|is|are|build|lead|grow|drive|win|write|cut|make|sell|run|set|see|manage|design|develop|own|deliver|maintain|partner|coordinate|support|oversee|implement|automate|architect|create|organise|organize|launch|ship|review|monitor|optimise|optimize|improve|increase|reduce|streamline|build|drive|lead|develop|design|ship|own|deliver|maintain|automate|architect|create|launch|review|monitor|optimise|optimize|improve|increase|reduce|streamline)s?\b/i;

function firstWord(line: string): string {
  return line.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
}

function analyseBullet(raw: string, isCurrent: boolean): BulletAnalysis {
  const text = raw.replace(/^[•·*\-–\s]+/, "").trim();
  const flags = new Set<BulletFlag>();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Action verb / weak opener
  const fw = firstWord(text);
  const startsWeak = WEAK_OPENERS.some((re) => re.test(text));
  if (startsWeak) {
    flags.add("weak_opener");
  } else if (STRONG_VERBS.has(fw)) {
    flags.add("action_verb");
  }

  // Quantification
  if (QUANT.test(text)) flags.add("quantified");

  // XYZ heuristic: contains a result/by/to/resulting/leading clause and is quantified.
  const xyzMarker = /(by\s+|through\s+|leading to\s+|resulting in\s+|which\s+(led|resulted)\s+|to\s+(achieve|deliver|enable|drive|reduce|increase|improve))/i;
  if (xyzMarker.test(text) && flags.has("quantified")) flags.add("xyz");

  // Length
  if (wordCount >= 8 && wordCount <= 20) flags.add("ideal_length");
  else if (wordCount < 8) flags.add("too_short");
  else if (wordCount > 30) flags.add("too_long");

  // First-person check
  if (FIRST_PERSON.test(text)) flags.add("first_person");

  // Tense check — for current roles, the first verb should be present tense.
  // For past roles, past tense. Action verbs ending in -ed are past.
  if (fw) {
    const isPast = fw.endsWith("ed") || PAST_TENSE.test(fw);
    const isPresent = !isPast && PRESENT_TENSE.test(fw);
    if (isCurrent && isPast && !isPresent && STRONG_VERBS.has(fw)) flags.add("tense_mismatch");
    if (!isCurrent && isPresent && !isPast && STRONG_VERBS.has(fw)) flags.add("tense_mismatch");
  }

  // Per-bullet score: start at 50, reward/penalise.
  let score = 50;
  if (flags.has("action_verb")) score += 20;
  if (flags.has("weak_opener")) score -= 20;
  if (flags.has("quantified")) score += 20;
  if (flags.has("xyz")) score += 10;
  if (flags.has("ideal_length")) score += 5;
  if (flags.has("too_short")) score -= 10;
  if (flags.has("too_long")) score -= 5;
  if (flags.has("first_person")) score -= 10;
  if (flags.has("tense_mismatch")) score -= 5;
  score = Math.max(0, Math.min(100, score));

  return {
    text,
    wordCount,
    flags: Array.from(flags),
    score,
  };
}

export function analyseBullets(parsed: ParsedResume): BulletReport {
  const roleReports: RoleBulletReport[] = [];

  for (const role of parsed.experience) {
    const isCurrent = (role.end_date ?? "").toLowerCase().includes("present") ||
      (role.end_date ?? "").toLowerCase().includes("current");
    const bullets = role.bullets.map((b) => analyseBullet(b, isCurrent));
    const averageScore = bullets.length
      ? Math.round(bullets.reduce((acc, b) => acc + b.score, 0) / bullets.length)
      : 0;
    roleReports.push({
      title: role.title,
      company: role.company,
      isCurrent,
      bullets,
      averageScore,
    });
  }

  const allBullets = roleReports.flatMap((r) => r.bullets);
  const overallImpactScore = allBullets.length
    ? Math.round(allBullets.reduce((acc, b) => acc + b.score, 0) / allBullets.length)
    : 0;

  // Roll-up top issues to expose in the issues list.
  const issueCounts = new Map<BulletFlag, number>();
  for (const b of allBullets) {
    for (const f of b.flags) {
      if (f === "action_verb" || f === "quantified" || f === "ideal_length" || f === "xyz") continue;
      issueCounts.set(f, (issueCounts.get(f) ?? 0) + 1);
    }
  }
  const topIssues: string[] = [];
  const issueMessages: Record<BulletFlag, string> = {
    action_verb: "",
    quantified: "",
    ideal_length: "",
    xyz: "",
    weak_opener: 'bullets start with weak openers like "responsible for" or "worked on"',
    too_short: "bullets are shorter than 8 words",
    too_long: "bullets are longer than 30 words",
    tense_mismatch: "bullets have tense inconsistent with the role's date range",
    first_person: 'bullets use first-person pronouns (I, me, my)',
  };

  for (const [flag, count] of issueCounts) {
    const msg = issueMessages[flag];
    if (!msg) continue;
    topIssues.push(`${count} ${msg}`);
  }

  const verbCount = allBullets.filter((b) => b.flags.includes("action_verb")).length;
  if (allBullets.length > 0 && verbCount / allBullets.length < 0.5) {
    topIssues.unshift(`Only ${verbCount} of ${allBullets.length} bullets start with a strong action verb`);
  }
  const quantCount = allBullets.filter((b) => b.flags.includes("quantified")).length;
  if (allBullets.length > 0 && quantCount / allBullets.length < 0.3) {
    topIssues.unshift(`Only ${quantCount} of ${allBullets.length} bullets contain a metric — add numbers, %, or $`);
  }

  return {
    roles: roleReports,
    overallImpactScore,
    totalBullets: allBullets.length,
    topIssues: topIssues.slice(0, 6),
  };
}
