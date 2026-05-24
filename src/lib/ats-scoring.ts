export type AtsScoreBand = "poor" | "fair" | "good" | "excellent";

export interface AtsSimulatorContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  parsedOk: boolean;
  issues: string[];
}

export interface AtsSimulatorExperience {
  role?: string;
  company?: string;
  duration?: string;
  description?: string;
  parsedOk: boolean;
}

export interface AtsSimulatorEducation {
  degree?: string;
  institution?: string;
  year?: string;
  parsedOk: boolean;
}

export interface AtsSimulatorSkill {
  name: string;
  type: "hard" | "soft";
}

export interface AtsSimulator {
  contact: AtsSimulatorContact;
  summary: { parsedText?: string; parsedOk: boolean };
  experience: AtsSimulatorExperience[];
  education: AtsSimulatorEducation[];
  skills: AtsSimulatorSkill[];
  certifications: string[];
  projects: string[];
  missingRequiredSections: string[];
}

export interface BulletAudit {
  text: string;
  section: string;
  actionVerb: boolean;
  quantified: boolean;
  xyzFormat: boolean;
  pronounUsed: boolean;
  tenseConsistency: "past" | "present" | "mixed" | "unknown";
  lengthOk: boolean;
  suggestions: string[];
}

export interface BulletAnalysis {
  bullets: BulletAudit[];
  impactScore: number;
}

export interface FormattingHazards {
  hasMultiColumnCrossover: boolean;
  hasTables: boolean;
  imageCount: number;
  hasHeaderText: boolean;
  hasEmojis: boolean;
  nonStandardFonts: boolean;
  issues: string[];
}

export interface MissingKeywordWithHint {
  keyword: string;
  type: "hard" | "soft" | "cert" | "tool";
  hint: string;
}

export interface ClicheBuzzwords {
  found: string[];
  scoreDeduction: number;
}

export interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  label: string;
}

export interface SriLankaContext {
  recognizedCompanies: string[];
  recognizedUniversities: string[];
  recognizedCerts: string[];
  hasNicWarning: boolean;
  phoneNormalized: boolean;
  isBilingual: boolean;
  languageHints: string[];
  tips: string[];
}

export type AtsScoreResult = {
  id?: string;
  extractedText?: string;
  overall: number;
  format: number;
  content: number;
  keywords: number;
  length: number;
  issues: string[];
  suggestions: string[];
  breakdown: {
    format: { score: number; max: 25 };
    content: { score: number; max: 25 };
    keywords: { score: number; max: 25 };
    length: { score: number; max: 25 };
  };
  jdKeywordMatchPct?: number;
  jdTopKeywords?: string[];
  matchingKeywords?: string[];
  missingKeywords?: string[];
  
  // Expanded metrics
  atsSimulator?: AtsSimulator;
  bulletAnalysis?: BulletAnalysis;
  formattingHazards?: FormattingHazards;
  missingKeywordsWithHints?: MissingKeywordWithHint[];
  clicheBuzzwords?: ClicheBuzzwords;
  readability?: ReadabilityMetrics;
  sriLankaContext?: SriLankaContext;
};

export const SCORE_BANDS = [
  [0, 59, "poor", "Needs major work"],
  [60, 74, "fair", "Below ATS-friendly"],
  [75, 84, "good", "ATS-friendly"],
  [85, 100, "excellent", "Top-tier ATS-optimised"],
] as const;

const colors: Record<AtsScoreBand, "danger" | "warning" | "success" | "primary"> = {
  poor: "danger",
  fair: "warning",
  good: "success",
  excellent: "primary",
};

const actionVerbs = [
  "achieved", "built", "created", "delivered", "developed", "improved", "increased",
  "launched", "led", "managed", "optimized", "reduced", "resolved", "shipped", "streamlined",
  "designed", "engineered", "formulated", "spearheaded", "implemented", "overhauled",
  "coordinated", "executed", "accelerated", "pioneered", "negotiated", "established"
];

const technicalSkills = [
  "accounting", "analytics", "aws", "azure", "django", "excel", "figma", "google analytics",
  "javascript", "marketing", "node.js", "postgresql", "power bi", "python", "react",
  "salesforce", "seo", "sql", "supabase", "typescript", "kubernetes", "docker", "next.js",
  "git", "graphql", "tailwind", "devops", "machine learning", "java", "c#", "php"
];

const softSkills = [
  "communication", "collaboration", "customer service", "leadership", "mentoring",
  "negotiation", "problem solving", "stakeholder management", "teamwork", "agile", "scrum",
  "time management", "adaptability", "critical thinking", "emotional intelligence"
];

const stopWords = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
  "by", "can", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself",
  "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just",
  "me", "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once",
  "only", "or", "other", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them",
  "themselves", "then", "there", "these", "they", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "we", "were", "what", "when", "where", "which",
  "while", "who", "whom", "why", "will", "with", "would", "you", "your", "yours", "yourself",
  "yourselves", "role", "team", "company", "candidate", "position", "requirements",
  "responsibilities", "required", "preferred"
]);

export function interpretScore(overall: number) {
  const band = SCORE_BANDS.find(([low, high]) => overall >= low && overall <= high);
  const key = (band?.[2] ?? (overall < 0 ? "poor" : "excellent")) as AtsScoreBand;

  return {
    band: key,
    label: band?.[3] ?? SCORE_BANDS.at(overall < 0 ? 0 : -1)?.[3] ?? "",
    color: colors[key],
  };
}

function keywordTokens(text: string) {
  return Array.from(text.toLowerCase().matchAll(/[a-z][a-z0-9.+#-]{1,}/g))
    .map((match) => match[0].replace(/\.$/, ""))
    .filter((token) => token && !stopWords.has(token));
}

export function extractJdKeywords(jobDescription: string, topK = 25) {
  const tokens = keywordTokens(jobDescription);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const bigram = `${tokens[index]} ${tokens[index + 1]}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left, leftCount], [right, rightCount]) => {
      if (rightCount !== leftCount) return rightCount - leftCount;
      const leftSpaces = (left.match(/ /g) ?? []).length;
      const rightSpaces = (right.match(/ /g) ?? []).length;
      if (leftSpaces !== rightSpaces) return leftSpaces - rightSpaces;
      return left.localeCompare(right);
    })
    .slice(0, topK)
    .map(([keyword]) => keyword);
}

function containsKeyword(keyword: string, text: string) {
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

function scoreFormat(text: string): [number, string[]] {
  let score = 25;
  const issues: string[] = [];

  if (/[^\x00-\x7F]+/.test(text) && !/[\u0D80-\u0DFF]/.test(text) && !/[\u0B80-\u0BFF]/.test(text)) {
    // Flag other special non-ASCII text, but ignore Sinhala & Tamil blocks
    score -= 5;
    issues.push("Contains special characters that may not parse correctly");
  }

  const formattingChars = (text.match(/[●•►▸◆■□]/g) ?? []).length;
  if (formattingChars > 15) {
    score -= 5;
    issues.push("Excessive formatting symbols detected");
  }

  if ((text.match(/\|/g) ?? []).length > 15) {
    score -= 5;
    issues.push("Table structures detected - may not parse well in some ATS parsers");
  }

  return [Math.max(0, score), issues];
}

function scoreContent(text: string): [number, string[]] {
  let score = 0;
  const issues: string[] = [];

  if (/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/.test(text)) {
    score += 5;
  } else {
    issues.push("No email address found");
  }

  if (/(?:\+94|0)?\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}|\(?\d{3}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/.test(text)) {
    score += 5;
  } else {
    issues.push("No phone number found");
  }

  const sections = [
    ["experience", /(work experience|experience|work history|employment)/],
    ["education", /(education|academic|degree)/],
    ["skills", /(skills|competencies|expertise)/],
  ] as const;

  for (const [name, pattern] of sections) {
    if (pattern.test(text)) {
      score += 5;
    } else {
      issues.push(`Missing '${name[0].toUpperCase()}${name.slice(1)}' section`);
    }
  }

  return [score, issues];
}

function scoreKeywords(text: string, jobDescription = ""): [number, string[]] {
  const issues: string[] = [];

  if (jobDescription) {
    const jdKeywords = extractJdKeywords(jobDescription);

    if (jdKeywords.length > 5) {
      const found = jdKeywords.filter((keyword) => text.includes(keyword)).length;
      const matchPct = found / jdKeywords.length;

      if (matchPct < 0.4) {
        issues.push("Your resume has a very low keyword match with the provided job description.");
      } else if (matchPct < 0.7) {
        issues.push("Missing several keywords specific to the job description.");
      }

      return [Math.min(25, Math.floor(matchPct * 25)), issues];
    }
  }

  const actionVerbCount = actionVerbs.filter((verb) => containsKeyword(verb, text)).length;
  const techSkillCount = technicalSkills.filter((skill) => containsKeyword(skill, text)).length;
  const softSkillCount = softSkills.filter((skill) => containsKeyword(skill, text)).length;
  let score = Math.min(10, actionVerbCount * 2);
  score += Math.min(10, techSkillCount * 2);
  score += Math.min(5, softSkillCount);

  if (actionVerbCount < 3) {
    issues.push("Use more action verbs such as achieved, managed, or developed");
  }

  if (techSkillCount === 0 && softSkillCount === 0) {
    issues.push("Add relevant technical and soft skills");
  }

  return [score, issues];
}

function scoreLength(text: string): [number, string[]] {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  if (wordCount >= 400 && wordCount <= 800) return [25, []];
  if (wordCount >= 300 && wordCount < 400) return [20, ["Resume is a bit short - consider adding more detail"]];
  if (wordCount > 800 && wordCount <= 1000) return [20, ["Resume is slightly long - consider being more concise"]];
  if (wordCount > 1000) return [10, ["Resume is too long - aim for 1-2 pages"]];

  return [5, ["Resume is too short - add more content"]];
}

function suggestionsFromIssues(issues: string[]) {
  const suggestions = new Set<string>();
  const map = [
    ["email", "Add a professional email address in the header"],
    ["phone", "Include your phone number for contact purposes"],
    ["action verbs", "Use strong action verbs to describe your achievements"],
    ["skills", "Add a dedicated skills section with relevant keywords"],
    ["experience", "Include a professional experience or work history section"],
    ["education", "Add your education details including degree and institution"],
    ["special characters", "Remove special characters and use simple formatting"],
    ["long", "Condense content to fit 1-2 pages for better readability"],
    ["keyword", "Mirror important job-description keywords honestly in your resume"],
  ] as const;

  for (const issue of issues) {
    const lower = issue.toLowerCase();
    const match = map.find(([key]) => lower.includes(key));
    if (match) suggestions.add(match[1]);
  }

  return [...suggestions].slice(0, 5);
}

function jdKeywordMatch(text: string, jobDescription: string) {
  const keywords = extractJdKeywords(jobDescription);
  if (keywords.length === 0) {
    return { jdKeywordMatchPct: 0, jdTopKeywords: [] };
  }

  const resumeTokenList = keywordTokens(text);
  const resumeTokens = new Set(resumeTokenList);
  const resumeBigrams = new Set(resumeTokenList.slice(0, -1).map((token, index) => `${token} ${resumeTokenList[index + 1]}`));
  const lowerText = text.toLowerCase();
  const matched = keywords.filter((keyword) =>
    keyword.includes(" ") ? resumeBigrams.has(keyword) || lowerText.includes(keyword) : resumeTokens.has(keyword)
  ).length;

  return {
    jdKeywordMatchPct: Math.round((matched / keywords.length) * 100),
    jdTopKeywords: keywords,
  };
}

export function scoreResumeText(text: string, jobDescription = ""): AtsScoreResult {
  const lower = text.toLowerCase();
  const [format, formatIssues] = scoreFormat(text);
  const [content, contentIssues] = scoreContent(lower);
  const [keywords, keywordIssues] = scoreKeywords(lower, jobDescription.toLowerCase());
  const [length, lengthIssues] = scoreLength(text);
  const issues = [...formatIssues, ...contentIssues, ...keywordIssues, ...lengthIssues];
  
  // 1. Contact Validation local checks
  const emailMatch = text.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i);
  const phoneMatch = text.match(/(?:\+94|0)?\s?7\d[\s-]?\d{3}[\s-]?\d{4}|\+?94\d{9}/);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  const locationMatch = text.match(/(colombo|kandy|galle|jaffna|negombo|gampaha|kurunegala|batticaloa|sri lanka)/i);

  // Sri Lanka moat dictionaries
  const slCompaniesList = ["dialog", "wso2", "mas holdings", "brandix", "hirdaramani", "ifs", "99x", "millenniumit", "john keells", "hutch", "hnb", "boc", "sampath bank", "lolc", "hemas", "hayleys", "cargills"];
  const slUniversitiesList = ["moratuwa", "colombo", "peradeniya", "kelaniya", "sliit", "nsbm", "nibm", "iit", "apiit", "icbt", "curtin", "aod", "ucsc"];
  const slCertsList = ["cima", "acca", "ca sri lanka", "cma", "aat", "slim", "ipm"];
  const clicheWordsList = ["hardworking", "team player", "go-getter", "synergy", "results-oriented", "detail-oriented", "passionate", "fast learner"];

  const recognizedCompanies = slCompaniesList.filter(c => lower.includes(c)).map(c => c.toUpperCase());
  const recognizedUniversities = slUniversitiesList.filter(u => lower.includes(u)).map(u => u.toUpperCase());
  const recognizedCerts = slCertsList.filter(cert => lower.includes(cert)).map(cert => cert.toUpperCase());
  const foundCliches = clicheWordsList.filter(word => lower.includes(word));

  const hasNicWarning = /(\b\d{9}[VvXx]\b|\b\d{12}\b)/.test(text);
  if (hasNicWarning) {
    issues.push("NIC warning: National Identity Card details found. Avoid sharing NIC on your public CV.");
  }

  const phoneNormalized = phoneMatch ? phoneMatch[0].startsWith("+94") || phoneMatch[0].startsWith("07") : false;

  const isSinhala = /[\u0D80-\u0DFF]/.test(text);
  const isTamil = /[\u0B80-\u0BFF]/.test(text);
  const isBilingual = isSinhala || isTamil;

  const languageHints = [];
  if (isSinhala) languageHints.push("Sinhala unicode content detected");
  if (isTamil) languageHints.push("Tamil unicode content detected");

  const slTips = [];
  if (hasNicWarning) slTips.push("Remove national identity card (NIC) numbers from your resume to protect your privacy.");
  if (phoneMatch && !phoneNormalized) slTips.push("Normalise your phone number using the Sri Lankan standard (+947...) for automated parsers.");
  if (recognizedUniversities.length > 0) slTips.push("Recognized Sri Lankan university. Boosts parsing validation accuracy.");

  // Bullet level analysis approximation
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 10);
  const bulletsAudited: BulletAudit[] = [];
  let actionVerbCount = 0;
  let quantifiedCount = 0;
  let xyzCount = 0;
  let pronounsCount = 0;

  for (const line of lines.slice(0, 15)) {
    const wordCount = line.split(/\s+/).length;
    if (wordCount < 5) continue;

    const startsWithVerb = actionVerbs.some(v => line.toLowerCase().startsWith(v) || line.toLowerCase().split(/\s+/).slice(0, 2).includes(v));
    const hasNum = /\b\d+%?\b/.test(line);
    const hasXyzKeywords = /\b(by|result|resulting|led to|impact|improved|increased|achieved|reduced|optimized)\b/i.test(line);
    const hasPronouns = /\b(i|me|my|we|our)\b/i.test(line);
    
    if (startsWithVerb) actionVerbCount++;
    if (hasNum) quantifiedCount++;
    if (hasXyzKeywords) xyzCount++;
    if (hasPronouns) pronounsCount++;

    bulletsAudited.push({
      text: line,
      section: line.toLowerCase().includes("university") || line.toLowerCase().includes("school") ? "Education" : "Experience",
      actionVerb: startsWithVerb,
      quantified: hasNum,
      xyzFormat: hasXyzKeywords && startsWithVerb && hasNum,
      pronounUsed: hasPronouns,
      tenseConsistency: line.toLowerCase().includes("ed") ? "past" : "present",
      lengthOk: wordCount >= 8 && wordCount <= 20,
      suggestions: [
        !startsWithVerb ? "Start with a strong action verb (e.g. Led, Designed, Overhauled)" : "",
        !hasNum ? "Quantify the impact with numbers or percentages (e.g. 15% increase, $10k saved)" : "",
        hasPronouns ? "Remove personal pronouns (I, me, my, we)" : ""
      ].filter(Boolean)
    });
  }

  const totalBullets = bulletsAudited.length || 1;
  const impactScore = Math.round(
    ((actionVerbCount / totalBullets) * 30) +
    ((quantifiedCount / totalBullets) * 35) +
    ((xyzCount / totalBullets) * 20) +
    ((1 - pronounsCount / totalBullets) * 15)
  );

  // Readability
  const wordCount = text.split(/\s+/).filter(Boolean).length || 1;
  const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 5).length || 1;
  const syllablesEst = wordCount * 1.55;
  const gradeLevel = Math.round(0.39 * (wordCount / sentenceCount) + 11.8 * (syllablesEst / wordCount) - 15.59);
  
  const result: AtsScoreResult = {
    overall: format + content + keywords + length,
    format,
    content,
    keywords,
    length,
    issues,
    suggestions: suggestionsFromIssues(issues),
    breakdown: {
      format: { score: format, max: 25 },
      content: { score: content, max: 25 },
      keywords: { score: keywords, max: 25 },
      length: { score: length, max: 25 },
    },
    atsSimulator: {
      contact: {
        name: text.split(/\n/)[0]?.trim() || "Applicant",
        email: emailMatch?.[0],
        phone: phoneMatch?.[0],
        location: locationMatch?.[0] || "Sri Lanka",
        linkedin: linkedinMatch?.[0],
        parsedOk: !!(emailMatch && phoneMatch),
        issues: [
          !emailMatch ? "Email address not found or unparseable" : "",
          !phoneMatch ? "Phone number not found or format unrecognized" : ""
        ].filter(Boolean)
      },
      summary: {
        parsedText: text.substring(0, 200) + "...",
        parsedOk: text.length > 200
      },
      experience: bulletsAudited.filter(b => b.section === "Experience").map(b => ({
        role: "Professional Role",
        company: "Company Name",
        description: b.text,
        parsedOk: true
      })),
      education: bulletsAudited.filter(b => b.section === "Education").map(() => ({
        degree: "Academic Degree",
        institution: "Educational Institution",
        parsedOk: true
      })),
      skills: [
        ...technicalSkills.filter(s => lower.includes(s)).map(s => ({ name: s, type: "hard" as const })),
        ...softSkills.filter(s => lower.includes(s)).map(s => ({ name: s, type: "soft" as const }))
      ] as AtsSimulatorSkill[],
      certifications: recognizedCerts,
      projects: [],
      missingRequiredSections: [
        !/experience/i.test(text) ? "Experience" : "",
        !/education/i.test(text) ? "Education" : "",
        !/skills/i.test(text) ? "Skills" : ""
      ].filter(Boolean)
    },
    bulletAnalysis: {
      bullets: bulletsAudited,
      impactScore
    },
    formattingHazards: {
      hasMultiColumnCrossover: text.includes("   ") && text.length > 1000,
      hasTables: text.includes("|") || text.includes("\t\t"),
      imageCount: 0,
      hasHeaderText: false,
      hasEmojis: /[^\x00-\x7F\s\u0D80-\u0DFF\u0B80-\u0BFF]/.test(text),
      nonStandardFonts: false,
      issues: [
        text.includes("|") ? "Contains vertical pipes (|), indicative of tables that break reading order." : "",
        text.includes("   ") ? "Spaced column-like text blocks found. Multi-column resumes confuse ATS scanners." : ""
      ].filter(Boolean)
    },
    missingKeywordsWithHints: jobDescription ? extractJdKeywords(jobDescription).slice(10).map(k => ({
      keyword: k,
      type: technicalSkills.includes(k) ? "hard" : softSkills.includes(k) ? "soft" : "tool",
      hint: `Add this keyword to your Skills section or integrate it into a project description.`
    })) : [],
    clicheBuzzwords: {
      found: foundCliches,
      scoreDeduction: foundCliches.length * 2
    },
    readability: {
      fleschKincaidGrade: Math.min(20, Math.max(1, gradeLevel)),
      label: gradeLevel <= 10 && gradeLevel >= 7 ? "Ideal readability (Professional & Accessible)" : gradeLevel > 14 ? "Too dense (Highly academic/complex prose)" : "Simple prose"
    },
    sriLankaContext: {
      recognizedCompanies,
      recognizedUniversities,
      recognizedCerts,
      hasNicWarning,
      phoneNormalized,
      isBilingual,
      languageHints,
      tips: slTips
    }
  };

  if (jobDescription.trim()) {
    Object.assign(result, jdKeywordMatch(text, jobDescription));
  }

  return result;
}
