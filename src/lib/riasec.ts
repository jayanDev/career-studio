/**
 * Holland RIASEC career-interest assessment.
 *
 * 24 short statements (4 per type) the user agrees with on a 1-5 scale.
 * Scoring sums the points per type, takes the top 3 by score, and emits
 * a 3-letter Holland code (e.g. "IAS" = Investigative-Artistic-Social).
 *
 * The 6 types:
 *   R - Realistic   (builders, hands-on, mechanical, outdoors)
 *   I - Investigative (analytical, scientific, research, ideas)
 *   A - Artistic    (creative, design, expressive, original)
 *   S - Social      (helpers, teachers, communicators, carers)
 *   E - Enterprising (leaders, persuaders, sellers, organisers)
 *   C - Conventional (organisers, detail, process, numbers)
 *
 * The code drops into the Career GPS pipeline as `hollandCode` —
 * existing logic in career-gps-insights already consumes it.
 */

export type RiasecType = "R" | "I" | "A" | "S" | "E" | "C";

export type RiasecQuestion = {
  id: string;
  type: RiasecType;
  prompt: string;
};

export const RIASEC_TYPE_LABELS: Record<RiasecType, { label: string; tagline: string }> = {
  R: { label: "Realistic", tagline: "Builders & doers" },
  I: { label: "Investigative", tagline: "Thinkers & researchers" },
  A: { label: "Artistic", tagline: "Creators & designers" },
  S: { label: "Social", tagline: "Helpers & teachers" },
  E: { label: "Enterprising", tagline: "Leaders & persuaders" },
  C: { label: "Conventional", tagline: "Organisers & analysts" },
};

export const RIASEC_QUESTIONS: RiasecQuestion[] = [
  // R - Realistic
  { id: "r1", type: "R", prompt: "I enjoy fixing or building things with my hands." },
  { id: "r2", type: "R", prompt: "I'd rather be outdoors working with tools than in an office." },
  { id: "r3", type: "R", prompt: "Mechanical or physical problems excite me." },
  { id: "r4", type: "R", prompt: "I'm drawn to roles that involve machinery, electronics, or construction." },
  // I - Investigative
  { id: "i1", type: "I", prompt: "I love digging into data to understand why something happens." },
  { id: "i2", type: "I", prompt: "I prefer figuring out problems myself rather than asking for help." },
  { id: "i3", type: "I", prompt: "I'm energised by scientific or technical research." },
  { id: "i4", type: "I", prompt: "I enjoy reading deeply about complex topics." },
  // A - Artistic
  { id: "a1", type: "A", prompt: "I lose track of time when I'm making something creative." },
  { id: "a2", type: "A", prompt: "I'd rather express my own ideas than follow someone else's structure." },
  { id: "a3", type: "A", prompt: "I notice design, colour, and aesthetics where most people don't." },
  { id: "a4", type: "A", prompt: "I'm drawn to writing, design, music, film, or visual storytelling." },
  // S - Social
  { id: "s1", type: "S", prompt: "I enjoy teaching or coaching others through what I know." },
  { id: "s2", type: "S", prompt: "I'd rather work with people than with data or machines." },
  { id: "s3", type: "S", prompt: "People often come to me when they need to talk something through." },
  { id: "s4", type: "S", prompt: "I'm energised by helping others reach their goals." },
  // E - Enterprising
  { id: "e1", type: "E", prompt: "I like persuading people to my point of view." },
  { id: "e2", type: "E", prompt: "I enjoy leading teams or projects." },
  { id: "e3", type: "E", prompt: "Sales, negotiation, and dealmaking energise me." },
  { id: "e4", type: "E", prompt: "I'd start my own business if the right idea came along." },
  // C - Conventional
  { id: "c1", type: "C", prompt: "I'm happiest when work is organised and predictable." },
  { id: "c2", type: "C", prompt: "I enjoy tasks that need accuracy and attention to detail." },
  { id: "c3", type: "C", prompt: "I'd rather follow a clear process than improvise." },
  { id: "c4", type: "C", prompt: "Spreadsheets, budgets, and structured data appeal to me." },
];

/**
 * Score a set of answers (id → 1-5 scale) and return the top-3 RIASEC
 * code. Answers may be partial — missing IDs are treated as 0.
 */
export function computeRiasecCode(answers: Record<string, number>): {
  code: string;
  scores: Record<RiasecType, number>;
  ranked: Array<{ type: RiasecType; score: number }>;
} {
  const scores: Record<RiasecType, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  for (const q of RIASEC_QUESTIONS) {
    const raw = answers[q.id];
    // `typeof NaN === "number"` so we have to filter NaN explicitly — a
    // bad form field can otherwise propagate NaN through the running total.
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const clamped = Math.max(1, Math.min(5, Math.round(raw)));
    scores[q.type] += clamped;
  }

  const ranked = (Object.keys(scores) as RiasecType[])
    .map((type) => ({ type, score: scores[type] }))
    .sort((a, b) => b.score - a.score);

  const code = ranked.slice(0, 3).map((r) => r.type).join("");
  return { code, scores, ranked };
}
