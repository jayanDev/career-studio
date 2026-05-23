import { extractStructuredJdKeywords } from "@/lib/linkedin-optimization";
import { normalizeLkPhone } from "@/lib/phone";
import { slCompanies } from "@/lib/sl-data";
import type { CoverLetterContent } from "@/lib/resume-content";

export type CoverLetterLengthTarget = "short" | "standard" | "long";
export type CoverLetterLanguage = "en" | "si" | "ta" | "bilingual_si" | "bilingual_ta";
export type CoverLetterMode = "local" | "international";

export type CoverLetterJdProfile = {
  company_name: string;
  role_title: string;
  hiring_manager: string;
  team: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  values: string[];
  tone_signal: "formal" | "startup" | "mission-driven" | "technical" | "executive";
  seniority: string;
};

export type CoverLetterScore = {
  score: number;
  label: string;
  components: {
    jdSpecificity: number;
    quantifiedAchievements: number;
    opener: number;
    length: number;
    closer: number;
    grammar: number;
  };
  matchedKeywords: string[];
  missingKeywords: { keyword: string; placement: string; priority: "HIGH" | "MEDIUM" }[];
  grammarIssues: string[];
  wordCount: number;
  targetRange: { min: number; max: number };
  suggestions: string[];
};

export const coverLetterLengthRanges: Record<CoverLetterLengthTarget, { min: number; max: number; label: string }> = {
  short: { min: 180, max: 220, label: "Short form" },
  standard: { min: 300, max: 400, label: "Standard" },
  long: { min: 500, max: 650, label: "Long form" },
};

export const coverLetterTonePreviews: Record<string, string> = {
  PROFESSIONAL:
    "I am excited to bring practical experience, disciplined execution, and clear communication to this role.",
  CONFIDENT:
    "I can help your team turn the priorities in this role into measurable outcomes from the first quarter.",
  WARM:
    "What draws me to this opportunity is the chance to contribute useful work with a team whose mission genuinely resonates with me.",
  EXECUTIVE:
    "I bring a strategic record of aligning teams, resources, and measurable outcomes around business-critical priorities.",
  CONVERSATIONAL:
    "This role caught my attention because it connects directly with the kind of work I do best.",
  ENTHUSIASTIC:
    "I am genuinely excited about this opportunity and the impact I could help your team create.",
};

export const coverLetterTemplateGallery = [
  { key: "classic", name: "Classic ATS", layout: "Letterhead", atsSafe: true, accent: "#0f766e" },
  { key: "modern", name: "Modern Match", layout: "Resume-matched header", atsSafe: true, accent: "#2563eb" },
  { key: "executive", name: "Executive", layout: "Formal address block", atsSafe: true, accent: "#111827" },
  { key: "visual", name: "Visual SL", layout: "Accent bar and optional photo", atsSafe: false, accent: "#b45309" },
  { key: "government", name: "SL Public Sector", layout: "Rigid formal format", atsSafe: true, accent: "#334155" },
];

export const slCompanyToneHints: Record<string, string> = {
  MAS: "operations-led, metrics-driven, factory excellence language",
  Brandix: "operations-led, sustainable apparel and quality language",
  Hirdaramani: "manufacturing excellence, people and sustainability language",
  WSO2: "engineering depth, open-source contribution, API and platform language",
  IFS: "enterprise software, customer outcomes, product engineering language",
  "99x": "product engineering, agile delivery, innovation language",
  "John Keells": "conglomerate, business-led, multi-industry framing",
  Cargills: "customer, retail operations, local market language",
  Hayleys: "diversified business, operational discipline, export-market language",
  Dialog: "consumer-tech, customer obsession, connectivity language",
  Hutch: "consumer-tech, growth, mobile customer language",
  HNB: "formal, qualifications-first, banking controls language",
  Commercial: "formal, qualifications-first, banking controls language",
  BOC: "public trust, formal, banking service language",
  NDB: "formal, relationship banking, risk-aware language",
};

export const coverLetterSentenceLibrary = {
  openers: [
    "I am drawn to {company}'s role in {industry} and the opportunity to contribute as {role}.",
    "With hands-on experience that maps closely to your requirements, I am excited to apply for the {role} role at {company}.",
    "Your search for a {role} stood out because it matches the work I have been doing across delivery, problem-solving, and measurable results.",
    "I was excited to see {company}'s opening for {role}, particularly because the role calls for practical execution and clear stakeholder communication.",
  ],
  closers: [
    "I would welcome the opportunity to discuss how my experience can support your team's priorities.",
    "Thank you for your time and consideration; I would be glad to speak further about the value I can bring.",
    "I look forward to the possibility of contributing to {company} and would appreciate the opportunity to discuss the role.",
  ],
  achievements: [
    "Delivered measurable improvements by clarifying goals, coordinating stakeholders, and tracking outcomes through completion.",
    "Improved team execution by turning broad priorities into practical milestones and visible progress.",
    "Strengthened quality and consistency by standardising workflows, reviewing results, and acting on feedback.",
  ],
};

export const industryCoverLetterOpeners: Record<string, string[]> = {
  bpo: [
    "I am drawn to {company}'s expanding presence in the global BPO sector and the chance to bring disciplined service delivery to the {role} role.",
    "Your focus on customer experience, quality, and operational consistency makes the {role} opportunity at {company} a strong match for my background.",
  ],
  apparel: [
    "With {company}'s role in Sri Lanka's apparel sector, I am excited by the opportunity to contribute practical execution and measurable improvement as {role}.",
    "I am especially interested in {company}'s reputation for quality, sustainability, and manufacturing excellence.",
  ],
  tourism: [
    "As Sri Lanka's tourism sector continues to rebuild, I am excited by the chance to contribute to {company}'s guest experience and service standards.",
    "The {role} opportunity at {company} stands out because it combines hospitality, operational detail, and genuine customer care.",
  ],
  banking: [
    "I am drawn to {company}'s reputation for trust, compliance, and customer service in Sri Lanka's banking sector.",
    "The {role} role at {company} aligns closely with my interest in disciplined financial operations and risk-aware execution.",
  ],
  tech: [
    "I am excited by {company}'s engineering culture and the opportunity to contribute practical technical depth as {role}.",
    "The {role} opening at {company} stood out because it calls for product thinking, delivery discipline, and technical ownership.",
  ],
};

export function parseCoverLetterJd(input: {
  jobDescription: string;
  jobTitle?: string;
  companyName?: string;
}): CoverLetterJdProfile {
  const text = input.jobDescription || "";
  const lower = text.toLowerCase();
  const structured = extractStructuredJdKeywords(text, input.jobTitle ?? "");
  const companyFromText = matchLine(text, /(?:company|employer|organisation|organization)\s*[:\-]\s*(.+)/i);
  const roleFromText = matchLine(text, /(?:role|position|job title)\s*[:\-]\s*(.+)/i);
  const hiringManager = matchLine(text, /(?:hiring manager|reports to|contact)\s*[:\-]\s*(.+)/i);
  const team = matchLine(text, /(?:team|department|division)\s*[:\-]\s*(.+)/i);
  const values = [
    /sustainab/i.test(text) ? "sustainability" : "",
    /customer|client/i.test(text) ? "customer focus" : "",
    /innov/i.test(text) ? "innovation" : "",
    /compliance|risk|governance/i.test(text) ? "compliance" : "",
    /mission|community|impact/i.test(text) ? "mission impact" : "",
  ].filter(Boolean);

  return {
    company_name: input.companyName || companyFromText || inferKnownCompany(text) || "",
    role_title: input.jobTitle || roleFromText || "",
    hiring_manager: hiringManager,
    team,
    must_have_skills: [...structured.hard_skills, ...structured.tools, ...structured.certifications].slice(0, 12),
    nice_to_have_skills: structured.soft_skills.slice(0, 8),
    values: values.length ? values : ["quality", "collaboration"],
    tone_signal: inferToneSignal(lower),
    seniority: structured.seniority,
  };
}

export function scoreCoverLetter(input: {
  content: CoverLetterContent;
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  lengthTarget?: CoverLetterLengthTarget;
}): CoverLetterScore {
  const text = coverLetterPlainText(input.content);
  const lower = text.toLowerCase();
  const jd = parseCoverLetterJd(input);
  const keywords = Array.from(new Set([...jd.must_have_skills, ...jd.nice_to_have_skills])).filter(Boolean);
  const matchedKeywords = keywords.filter((keyword) => lower.includes(keyword.toLowerCase()));
  const missingKeywords = keywords
    .filter((keyword) => !matchedKeywords.includes(keyword))
    .slice(0, 8)
    .map((keyword, index) => ({
      keyword,
      priority: index < 4 ? "HIGH" as const : "MEDIUM" as const,
      placement: index < 3 ? "Body paragraph 1 or achievements" : "Closing context or skills sentence",
    }));
  const wordCount = countWords(text);
  const targetRange = coverLetterLengthRanges[input.lengthTarget ?? input.content.lengthTarget ?? "standard"];
  const companyMentioned = Boolean(input.companyName && lower.includes(input.companyName.toLowerCase()));
  const roleMentioned = Boolean(input.jobTitle && lower.includes(input.jobTitle.toLowerCase()));
  const managerMentioned = Boolean(jd.hiring_manager && lower.includes(jd.hiring_manager.toLowerCase()));
  const keywordRatio = keywords.length ? matchedKeywords.length / keywords.length : 0.5;
  const jdSpecificity = Math.min(25, Math.round((companyMentioned ? 6 : 0) + (roleMentioned ? 5 : 0) + (managerMentioned ? 3 : 0) + keywordRatio * 14));
  const quantifiedAchievements = /\b\d+[%x]?\b|rs\.?|lkr|usd|million|revenue|reduced|increased|improved/i.test(text) ? 20 : input.content.achievements.length ? 12 : 4;
  const weakOpener = /^i\s+am\s+writing\s+to\s+apply/i.test(input.content.opener.trim());
  const opener = Math.min(15, (weakOpener ? 4 : 9) + (/[?]|\bdelivered|improved|led|built|grew|reduced/i.test(input.content.opener) ? 4 : 0) + (companyMentioned ? 2 : 0));
  const length = wordCount >= targetRange.min && wordCount <= targetRange.max ? 15 : Math.max(3, 15 - Math.ceil(Math.abs(wordCount - midpoint(targetRange)) / 35));
  const closer = /\b(discuss|conversation|interview|speak|call|contribute|opportunity)\b/i.test(input.content.closing) ? 15 : 7;
  const grammarIssues = checkCoverLetterGrammar(text);
  const grammar = Math.max(0, 10 - grammarIssues.length * 2);
  const score = clamp(jdSpecificity + quantifiedAchievements + opener + length + closer + grammar, 0, 100);
  const suggestions = [
    !companyMentioned ? `Mention ${input.companyName || "the company"} by name in the opener or closer.` : "",
    missingKeywords[0] ? `Weave in ${missingKeywords[0].keyword} where it is honestly supported by your experience.` : "",
    quantifiedAchievements < 20 ? "Add one quantified achievement with a number, percentage, budget, volume, or time saved." : "",
    weakOpener ? "Replace 'I'm writing to apply' with a sharper hook tied to the role." : "",
    wordCount > targetRange.max ? `Trim about ${wordCount - targetRange.max} words to fit the ${targetRange.label.toLowerCase()} target.` : "",
    wordCount < targetRange.min ? `Add ${targetRange.min - wordCount} words with role-specific evidence.` : "",
    grammarIssues[0] ?? "",
  ].filter(Boolean);

  return {
    score,
    label: coverLetterScoreLabel(score),
    components: { jdSpecificity, quantifiedAchievements, opener, length, closer, grammar },
    matchedKeywords,
    missingKeywords,
    grammarIssues,
    wordCount,
    targetRange: { min: targetRange.min, max: targetRange.max },
    suggestions,
  };
}

export function buildReferralOpener(input: { referrerName: string; referrerContext: string; jobTitle: string; companyName: string }) {
  if (!input.referrerName.trim()) return "";
  return `${input.referrerName}, who ${input.referrerContext || "knows my work"}, suggested I get in touch about the ${input.jobTitle} position at ${input.companyName}.`;
}

export function buildSalaryExpectationLine(input: { minimum: string; maximum: string; currency: string; period: string }) {
  if (!input.minimum && !input.maximum) return "";
  const range = input.minimum && input.maximum ? `${input.currency} ${input.minimum}-${input.maximum}` : `${input.currency} ${input.minimum || input.maximum}`;
  return `My salary expectation is in the range of ${range} ${input.period}, negotiable based on the full package and scope of the role.`;
}

export function suggestCompanyResearch(companyName: string, jobDescription: string) {
  const known = Object.entries(slCompanyToneHints).find(([name]) => companyName.toLowerCase().includes(name.toLowerCase()));
  const values = parseCoverLetterJd({ jobDescription, companyName }).values;
  return [
    known ? `${companyName} tone hint: ${known[1]}. Verify this against the current role before sending.` : "",
    values[0] ? `Why here: connect your motivation to ${values.slice(0, 2).join(" and ")}.` : "",
    "90-day angle: state one practical improvement you would help deliver in the first quarter.",
  ].filter(Boolean);
}

export function salutationFor(input: {
  hiringManager?: string;
  language?: CoverLetterLanguage;
  mode?: CoverLetterMode;
  industry?: string;
}) {
  if (input.hiringManager) return `Dear ${input.hiringManager}`;
  if (input.language === "si" || input.language === "bilingual_si") return "ආයුබෝවන්";
  if (input.language === "ta" || input.language === "bilingual_ta") return "வணக்கம்";
  if (input.mode === "local" && /bank|government|public|finance/i.test(input.industry ?? "")) return "Dear Sir/Madam";
  return "Dear Hiring Team";
}

export function followUpEmailTemplates(input: { jobTitle: string; companyName: string; name: string }) {
  const subject = `Following up on ${input.jobTitle} application`;
  return [
    {
      kind: "polite-check-in",
      subject,
      body: `Dear Hiring Team,\n\nI hope you are well. I wanted to follow up on my application for the ${input.jobTitle} role at ${input.companyName}. I remain very interested in the opportunity and would be glad to provide any additional information.\n\nKind regards,\n${input.name}`,
    },
    {
      kind: "value-add",
      subject,
      body: `Dear Hiring Team,\n\nI am following up on my ${input.jobTitle} application. Since applying, I have been thinking about the priorities in the role and would welcome the chance to discuss how my experience could support ${input.companyName}'s team.\n\nKind regards,\n${input.name}`,
    },
    {
      kind: "enthusiasm",
      subject,
      body: `Dear Hiring Team,\n\nI wanted to briefly reaffirm my interest in the ${input.jobTitle} role at ${input.companyName}. The opportunity still feels like a strong match for my experience, and I would be grateful for the chance to speak further.\n\nKind regards,\n${input.name}`,
    },
  ];
}

export function fillCoverLetterSentence(template: string, input: { companyName: string; jobTitle: string; industry?: string }) {
  return template
    .replaceAll("{company}", input.companyName || "the company")
    .replaceAll("{role}", input.jobTitle || "the role")
    .replaceAll("{industry}", input.industry || inferIndustry(`${input.companyName} ${input.jobTitle}`));
}

export function generateEmailReadyCoverLetter(input: {
  content: CoverLetterContent;
  jobTitle: string;
  companyName: string;
}) {
  const body = [
    input.content.opener,
    ...input.content.bodyParagraphs.slice(0, 1),
    input.content.achievements[0] ? `One relevant example: ${input.content.achievements[0]}` : "",
    input.content.closing,
    input.content.signature,
  ].filter(Boolean).join("\n\n");

  return {
    subject: `${input.jobTitle} - ${input.content.signature.split("\n").map((line) => line.trim()).filter(Boolean).at(-1) || "Application"}`,
    body,
  };
}

export function generateLinkedInDm(input: { content: CoverLetterContent; jobTitle: string; companyName: string }) {
  const opener = input.content.opener.replace(/\s+/g, " ").slice(0, 120);
  return `Hi, I just applied for the ${input.jobTitle} role at ${input.companyName}. ${opener} I would be grateful if you could point me to the right hiring contact.`;
}

export function generateApplicationComboPack(input: {
  content: CoverLetterContent;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}) {
  const jd = parseCoverLetterJd({ jobDescription: input.jobDescription, jobTitle: input.jobTitle, companyName: input.companyName });
  const skills = jd.must_have_skills.slice(0, 5);
  return {
    tailoredResumeNotes: [
      skills.length ? `Move these JD keywords into the top half of the resume where truthful: ${skills.join(", ")}.` : "Mirror the strongest JD requirements in summary, skills, and first experience entry.",
      "Put the most relevant experience entry first or make its bullets more prominent.",
      "Export both ATS-safe resume and this cover letter for online portals.",
    ],
    interviewQuestions: [
      `Why are you interested in the ${input.jobTitle} role at ${input.companyName}?`,
      skills[0] ? `Tell me about a time you used ${skills[0]} to deliver a measurable result.` : "Tell me about a measurable result from your recent work.",
      "What would you prioritise in your first 90 days?",
      "Which achievement in your cover letter best proves you can do this role?",
      "What would your previous manager say is your strongest contribution?",
      "How do you handle competing priorities?",
      "Why are you leaving or open to a new opportunity?",
      "What salary range and notice period should we be aware of?",
      "What do you still want to learn in this role?",
      "Do you have questions for our team?",
    ],
    hiringManagerDm: generateLinkedInDm(input),
  };
}

export function suggestSendingWindow(mode: CoverLetterMode) {
  if (mode === "local") {
    return "For SL applications, send Monday-Wednesday between 9-11am SLT when possible. Avoid late Friday and major holiday eves.";
  }
  return "For international applications, send during the recipient company's local morning and avoid Friday afternoon.";
}

export function coverLetterScoreLabel(score: number) {
  if (score >= 90) return "Recruiter-ready";
  if (score >= 75) return "Strong, minor polish";
  if (score >= 60) return "Generic - needs tailoring";
  return "Major work needed";
}

export function normalizeCoverLetterPhone(text: string) {
  return text.replace(/(?:\+94|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, (match) => {
    const normalized = normalizeLkPhone(match);
    return normalized.startsWith("+94") ? `+94 ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}` : normalized;
  });
}

export function coverLetterPlainText(content: CoverLetterContent) {
  return [
    content.headerContact,
    content.recipientDetails,
    content.opener,
    ...content.bodyParagraphs,
    ...content.achievements,
    content.closing,
    content.signature,
    content.salaryExpectation,
  ].filter(Boolean).join("\n\n");
}

function checkCoverLetterGrammar(text: string) {
  return [
    /\b(i am writing to apply|please find attached)\b/i.test(text) ? "Use a stronger opener than common template phrases." : "",
    /\b(responsible for|helped with|worked on)\b/i.test(text) ? "Replace weak phrases with action verbs and outcomes." : "",
    /\b(?:\d{9}[VvXx]|\d{12})\b/.test(text) ? "Remove NIC numbers from cover letters unless explicitly required." : "",
    (text.match(/\s{2,}/g) ?? []).length > 4 ? "Clean repeated spacing before export." : "",
    text.split(/\s+/).some((word) => word.length > 30) ? "Check unusually long words for spelling errors." : "",
  ].filter(Boolean);
}

function inferToneSignal(text: string): CoverLetterJdProfile["tone_signal"] {
  if (/startup|fast-paced|scrappy|founder|scale/i.test(text)) return "startup";
  if (/mission|ngo|community|impact|sustainab/i.test(text)) return "mission-driven";
  if (/architecture|engineering|technical|platform|cloud|api/i.test(text)) return "technical";
  if (/director|head of|executive|strategy|board/i.test(text)) return "executive";
  return "formal";
}

function inferKnownCompany(text: string) {
  const lower = text.toLowerCase();
  return slCompanies.find((company) => lower.includes(company.toLowerCase())) ?? "";
}

function inferIndustry(text: string) {
  const lower = text.toLowerCase();
  if (/bpo|call center|customer support|voice|csat|aht/.test(lower)) return "BPO";
  if (/apparel|garment|manufacturing|merchandising|aql/.test(lower)) return "Apparel";
  if (/tourism|hotel|hospitality|front office|guest/.test(lower)) return "Tourism";
  if (/bank|finance|kyc|aml|treasury|credit/.test(lower)) return "Banking";
  if (/software|engineer|developer|cloud|api|data/.test(lower)) return "Tech";
  return "your industry";
}

function matchLine(text: string, pattern: RegExp) {
  return text.match(pattern)?.[1]?.split(/\n/)[0]?.trim().slice(0, 120) ?? "";
}

function midpoint(range: { min: number; max: number }) {
  return Math.round((range.min + range.max) / 2);
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
