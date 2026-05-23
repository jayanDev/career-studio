import type { TalentProfile, TalentSkill, TalentExperience, TalentEducation, TalentCertification } from "@prisma/client";

import { extractStructuredJdKeywords } from "@/lib/linkedin-optimization";
import { slCertifications, slCompanies, slDistricts, slUniversities } from "@/lib/sl-data";

export const recruiterPlans = [
  {
    slug: "starter",
    name: "Recruiter Starter",
    priceLkr: 25000,
    credits: 50,
    savedSearches: 3,
    projects: 1,
    seats: 1,
    features: ["Verified company profile", "50 contact credits", "3 saved searches", "1 hiring project"],
  },
  {
    slug: "pro",
    name: "Recruiter Pro",
    priceLkr: 75000,
    credits: 250,
    savedSearches: -1,
    projects: 10,
    seats: 3,
    features: ["250 contact credits", "Unlimited saved searches", "10 hiring projects", "Response analytics"],
  },
  {
    slug: "enterprise",
    name: "Recruiter Enterprise",
    priceLkr: 0,
    credits: -1,
    savedSearches: -1,
    projects: -1,
    seats: -1,
    features: ["Unlimited seats", "ATS export", "API access", "Dedicated account manager"],
  },
];

export const slIndustrySearchPacks = [
  { slug: "bpo", name: "BPO talent", keywords: ["voice ops", "AHT", "FCR", "CSAT", "Six Sigma", "queue management"] },
  { slug: "apparel", name: "Apparel talent", keywords: ["production", "merchandising", "industrial engineering", "AQL", "line balancing"] },
  { slug: "tourism", name: "Tourism talent", keywords: ["front office", "F&B", "tour operations", "RevPAR", "ADR"] },
  { slug: "banking", name: "Banking talent", keywords: ["KYC", "AML", "trade finance", "treasury", "CASA", "NPL"] },
  { slug: "tea", name: "Tea / plantation talent", keywords: ["estate management", "factory operations", "quality control", "tea"] },
];

const prohibitedSearchTerms = [
  "religion",
  "race",
  "ethnicity",
  "marital",
  "married",
  "single women",
  "caste",
  "muslim only",
  "buddhist only",
  "christian only",
  "hindu only",
];

export function validateRecruiterSearch(query = "") {
  const lower = query.toLowerCase();
  const blocked = prohibitedSearchTerms.find((term) => lower.includes(term));
  if (blocked) {
    throw new Error(`Search blocked: '${blocked}' is not a permitted hiring filter.`);
  }
}

export function deriveCompanyDomain(websiteUrl: string, workEmail = "") {
  try {
    if (websiteUrl) {
      return new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace(/^www\./, "");
    }
  } catch {
    // Fall through to email domain.
  }
  return workEmail.includes("@") ? workEmail.split("@").pop()?.toLowerCase() ?? "" : "";
}

export function isWorkEmailVerifiedForDomain(workEmail: string, domain: string) {
  if (!workEmail || !domain || !workEmail.includes("@")) return false;
  const emailDomain = workEmail.split("@").pop()?.toLowerCase();
  return emailDomain === domain.toLowerCase();
}

export function parseSalaryExpectation(value: string) {
  const number = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export function calculateCandidateConfidence(profile: TalentProfile & {
  skills?: TalentSkill[];
  experiences?: TalentExperience[];
  educations?: TalentEducation[];
  certifications?: TalentCertification[];
}) {
  let score = 0;
  score += Math.min(30, Math.round((profile.completionScore || 0) * 0.3));
  score += profile.isVerified ? 10 : 0;
  score += profile.isOpenToWork ? 10 : 0;
  score += Math.min(15, (profile.skills?.length ?? 0) * 2);
  score += Math.min(15, (profile.experiences?.length ?? 0) * 5);
  score += Math.min(10, (profile.certifications?.length ?? 0) * 3);
  score += profile.cvPath ? 5 : 0;
  score += profile.updatedAt && Date.now() - profile.updatedAt.getTime() < 30 * 24 * 60 * 60 * 1000 ? 5 : 0;
  return Math.min(100, score);
}

export function isAnonymousProfile(visibility: string) {
  return visibility === "anonymous";
}

export function publicCandidateName(firstName: string, lastName: string, visibility: string) {
  if (isAnonymousProfile(visibility)) return "Anonymous candidate";
  return `${firstName} ${lastName}`.trim() || "Talent Pool Candidate";
}

export function buildCandidateSearchText(profile: {
  headline?: string | null;
  bio?: string | null;
  industry?: string | null;
  skills?: { name: string }[];
  experiences?: { title: string; companyName: string; description: string }[];
  educations?: { institutionName: string; degree: string; fieldOfStudy: string }[];
  certifications?: { name: string; issuingOrg: string }[];
}) {
  return [
    profile.headline,
    profile.bio,
    profile.industry,
    ...(profile.skills ?? []).map((item) => item.name),
    ...(profile.experiences ?? []).map((item) => `${item.title} ${item.companyName} ${item.description}`),
    ...(profile.educations ?? []).map((item) => `${item.institutionName} ${item.degree} ${item.fieldOfStudy}`),
    ...(profile.certifications ?? []).map((item) => `${item.name} ${item.issuingOrg}`),
  ].filter(Boolean).join("\n").toLowerCase();
}

export function scoreCandidateAgainstJd(profileText: string, jdText: string) {
  const keywords = extractStructuredJdKeywords(jdText);
  const weighted = [
    ...keywords.hard_skills.map((keyword) => ({ keyword, weight: 3 })),
    ...keywords.tools.map((keyword) => ({ keyword, weight: 3 })),
    ...keywords.certifications.map((keyword) => ({ keyword, weight: 3 })),
    ...keywords.soft_skills.map((keyword) => ({ keyword, weight: 1 })),
  ];
  const total = weighted.reduce((sum, item) => sum + item.weight, 0) || 1;
  const matched = weighted.filter((item) => profileText.includes(item.keyword.toLowerCase()));
  const score = Math.round((matched.reduce((sum, item) => sum + item.weight, 0) / total) * 100);
  return {
    score,
    matched: matched.map((item) => item.keyword),
    missing: weighted.filter((item) => !matched.includes(item)).map((item) => item.keyword).slice(0, 10),
  };
}

export function getSriLankaTalentHints(text: string) {
  const lower = text.toLowerCase();
  return {
    companies: slCompanies.filter((item) => lower.includes(item.toLowerCase())).slice(0, 8),
    universities: slUniversities.filter((item) => lower.includes(item.toLowerCase())).slice(0, 8),
    certs: slCertifications.filter((item) => lower.includes(item.toLowerCase())).slice(0, 8),
    districts: slDistricts.filter((item) => lower.includes(item.toLowerCase())).slice(0, 5),
  };
}
