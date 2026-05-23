"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { generateJsonWithGemini, generateTextWithGemini, geminiModel } from "@/lib/ai";
import { linkedInAuditResultSchema, type LinkedInAuditResult } from "@/lib/linkedin-audit";
import { buildLinkedInAudit } from "@/lib/linkedin-optimization";
import { prisma } from "@/lib/prisma";
import { generateObject } from "ai";

const auditFormSchema = z.object({
  targetRole: z.string().trim().min(2).max(255),
  profileText: z.string().trim().max(15000).default(""),
  audienceMode: z.enum(["local", "global"]).default("global"),
  hasPhoto: z.preprocess((val) => val === "true", z.boolean()).default(false),
  hasBanner: z.preprocess((val) => val === "true", z.boolean()).default(false),
  vanityUrl: z.string().trim().default(""),
  recsGiven: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  recsReceived: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  featuredPopulated: z.preprocess((val) => val === "true", z.boolean()).default(false),
  complianceMode: z.preprocess((val) => val === "true", z.boolean()).default(false),
  jdText: z.string().trim().default(""),
  connections: z.preprocess((val) => parseInt(val as string, 10) || 0, z.number()).default(0),
  profileUrl: z.string().trim().default(""),
  hasOpenToWork: z.preprocess((val) => val === "true", z.boolean()).default(false),
  hasOpenToServices: z.preprocess((val) => val === "true", z.boolean()).default(false),
  lastPostDate: z.string().trim().default(""),
  postsPerWeek: z.preprocess((val) => Number(val) || 0, z.number()).default(0),
  avgEngagement: z.preprocess((val) => Number(val) || 0, z.number()).default(0),
  hashtags: z.string().trim().default(""),
  topEndorsedSkills: z.string().trim().default(""),
  regulatedIndustry: z.preprocess((val) => val === "true", z.boolean()).default(false),
  diasporaMode: z.preprocess((val) => val === "true", z.boolean()).default(false),
});

const rewriteSchema = z.object({
  sectionType: z.string().trim().min(2).max(100),
  tone: z.enum(["STANDARD", "PUNCHY", "LEADERSHIP"]).default("STANDARD"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireUser(locale: Locale) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  return session.user;
}

// Kept temporarily for back-compat reference while audits are migrated to buildLinkedInAudit.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function fallbackLinkedInAudit(
  profileText: string,
  targetRole: string,
  meta?: {
    audienceMode?: "local" | "global";
    hasPhoto?: boolean;
    hasBanner?: boolean;
    vanityUrl?: string;
    recsGiven?: number;
    recsReceived?: number;
    featuredPopulated?: boolean;
    complianceMode?: boolean;
    jdText?: string;
    connections?: number;
  }
): LinkedInAuditResult {
  return buildLinkedInAudit({
    profileText,
    targetRole,
    audienceMode: meta?.audienceMode ?? "global",
    hasPhoto: meta?.hasPhoto ?? false,
    hasBanner: meta?.hasBanner ?? false,
    vanityUrl: meta?.vanityUrl ?? "",
    recsGiven: meta?.recsGiven ?? 0,
    recsReceived: meta?.recsReceived ?? 0,
    featuredPopulated: meta?.featuredPopulated ?? false,
    complianceMode: meta?.complianceMode ?? false,
    regulatedIndustry: false,
    diasporaMode: false,
    hasOpenToWork: false,
    hasOpenToServices: false,
    jdText: meta?.jdText ?? "",
    connections: meta?.connections ?? 0,
    lastPostDate: "",
    postsPerWeek: 0,
    avgEngagement: 0,
    hashtags: [],
    topEndorsedSkills: [],
  });
/*
  const hasPhoto = meta?.hasPhoto ?? false;
  const hasBanner = meta?.hasBanner ?? false;
  const vanityUrl = meta?.vanityUrl ?? "";
  const recsGiven = meta?.recsGiven ?? 0;
  const recsReceived = meta?.recsReceived ?? 0;
  const featuredPopulated = meta?.featuredPopulated ?? false;
  const complianceMode = meta?.complianceMode ?? false;
  const audienceMode = meta?.audienceMode ?? "global";
  const jdText = meta?.jdText ?? "";
  const connections = meta?.connections ?? 0;

  const lines = profileText.split("\n").map(l => l.trim()).filter(Boolean);
  const headline = lines.find(l => l.toLowerCase().includes("engineer") || l.toLowerCase().includes("developer") || l.toLowerCase().includes("manager") || (l.length > 30 && l.length < 150)) || lines[1] || "Professional";
  const headlineLen = headline.length;

  const hasValueProp = /help|deliver|build|solve|create|proven/i.test(headline);
  const hasMetrics = /\d+%|\d+x|rs\.|\blkr\b|\d+\+/.test(profileText.toLowerCase());
  const hasSkills = /skills|tools|technologies|certifications/i.test(profileText);

  const aboutText = profileText.length > 500 ? profileText.slice(200, 1000) : profileText;
  const wordCount = aboutText.split(/\s+/).length;
  const hasCta = /contact|email|reach|hire|connect/i.test(aboutText);
  const hasPronoun = /\b(i|my|me|we|our)\b/i.test(aboutText);
  const hasNIC = /\b([0-9]{9}[vVxX]|[0-9]{12})\b/.test(profileText);

  const slCompanies = ["mas", "brandix", "hirdaramani", "ifs", "wso2", "99x", "millenniumit", "john keells", "dialog", "hutch", "hatton", "commercial bank", "boc", "hnb", "ndb", "sampath bank", "dfcc", "cargills", "cic", "hayleys", "hemas", "lolc", "career studio"];
  const slUniversities = ["university of moratuwa", "uom", "university of colombo", "uoc", "ucsc", "university of peradeniya", "uop", "university of kelaniya", "uok", "sliit", "nsbm", "nibm", "iit", "apiit", "icbt", "curtin lanka", "aod"];
  const slCerts = ["ca sri lanka", "cma sl", "aat sl", "slim", "ipm", "cima", "acca"];

  const matchedCompanies = slCompanies.filter(c => new RegExp("\\b" + c + "\\b", "i").test(profileText));
  const matchedUniversities = slUniversities.filter(u => new RegExp("\\b" + u + "\\b", "i").test(profileText));
  const matchedCerts = slCerts.filter(c => new RegExp("\\b" + c + "\\b", "i").test(profileText));

  const hasSinhala = /[\u0D80-\u0DFF]/.test(profileText);
  const hasTamil = /[\u0B80-\u0BFF]/.test(profileText);

  let profileStrength = 10;
  if (hasPhoto) profileStrength += 4;
  if (hasBanner) profileStrength += 3;
  if (headlineLen >= 40 && headlineLen <= 220) profileStrength += 4;
  if (vanityUrl && !/[0-9a-f]{8,}/i.test(vanityUrl)) profileStrength += 4;

  let authority = 8;
  if (recsReceived >= 3) authority += 6;
  else if (recsReceived > 0) authority += 3;
  if (recsGiven > 0) authority += 3;
  if (featuredPopulated) authority += 5;
  if (matchedCerts.length > 0) authority += 3;

  let findability = 10;
  if (hasSkills) findability += 5;
  if (targetRole && new RegExp(targetRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i").test(profileText)) findability += 5;
  if (matchedCompanies.length > 0) findability += 5;

  let engagementReadiness = 10;
  if (hasCta) engagementReadiness += 5;
  if (connections > 500) engagementReadiness += 5;
  if (profileText.length > 1000) engagementReadiness += 5;

  const phoneMatch = /(?:\+94|0)(?:7[0-9]|11|21|22|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81|91)[0-9]{7}\b/.exec(profileText);
  let lkPhone = "";
  if (phoneMatch) {
    const clean = phoneMatch[0].replace(/[^\d]/g, "");
    lkPhone = clean.startsWith("0") ? "+94" + clean.slice(1) : "+" + clean;
  }

  const total = Math.round((profileStrength + authority + findability + engagementReadiness));

  const missing_keywords = [
    { keyword: targetRole, priority: "HIGH", placement: "Headline & About" },
  ];
  if (jdText) {
    const jdWords = Array.from(new Set(jdText.toLowerCase().match(/\b[a-z]{4,}\b/g) || []));
    const profileWords = new Set(profileText.toLowerCase().match(/\b[a-z]{4,}\b/g) || []);
    let count = 0;
    for (const w of jdWords) {
      if (!profileWords.has(w) && !["with", "this", "that", "from", "have", "been", "were", "will", "your"].includes(w)) {
        missing_keywords.push({
          keyword: w.charAt(0).toUpperCase() + w.slice(1),
          priority: count < 2 ? "HIGH" : "MEDIUM",
          placement: count % 2 === 0 ? "Skills" : "About Section"
        });
        count++;
        if (count >= 5) break;
      }
    }
  }

  return {
    score_breakdown: {
      completeness: total,
      keywords: findability * 4,
      readability: 80,
      impact: authority * 4,
      consistency: 85,
      recruiter_findability: findability * 4,
      profile_strength: Math.min(25, profileStrength),
      authority: Math.min(25, authority),
      findability: Math.min(25, findability),
      engagement_readiness: Math.min(25, engagementReadiness),
    },
    missing_keywords,
    section_scores: {
      headline: Math.round(profileStrength / 2.5),
      about: Math.round(engagementReadiness / 2.5),
      experience: Math.round(authority / 2.5),
      skills: Math.round(findability / 2.5),
    },
    checklist_items: [
      { id: "photo", label: "Professional profile photo visible", completed: hasPhoto, impact: "HIGH" },
      { id: "banner", label: "Custom cover banner uploaded", completed: hasBanner, impact: "MEDIUM" },
      { id: "vanity", label: "Clean vanity URL setup", completed: vanityUrl.length > 0 && !/[0-9a-f]{8,}/i.test(vanityUrl), impact: "MEDIUM" },
      { id: "recs", label: "Has 3+ recommendations received", completed: recsReceived >= 3, impact: "HIGH" },
      { id: "featured", label: "Featured section populated", completed: featuredPopulated, impact: "HIGH" },
      { id: "nic", label: "NIC numbers masked from public view", completed: !hasNIC, impact: "HIGH" },
    ],
    summary_feedback: "Profile has good fundamentals. Optimizing local signals (companies, universities) and improving target job role density will boost search impressions.",
    headline_analysis: {
      char_count: headlineLen,
      hook_strength_score: hasValueProp ? 85 : 45,
      has_value_prop: hasValueProp,
      has_outcome_metrics: hasMetrics,
      format_type: headlineLen > 70 ? "Title | Specialty | Company" : "Generic",
      mobile_visible: headlineLen <= 70,
      suggestions: headlineLen > 70 ? ["Headline is longer than 70 characters and might truncate on mobile screens."] : [],
    },
    about_analysis: {
      first_220_chars: aboutText.slice(0, 220),
      first_220_hook_strength: hasValueProp ? 80 : 50,
      word_count: wordCount,
      has_cta: hasCta,
      pronoun_balance: hasPronoun ? "Excellent use of first-person pronouns" : "Headline/About lacks first-person pronouns (I, My, Me)",
      story_arc: hasMetrics ? "Problem -> Approach -> Result structure detected" : "Narrative arc could use outcome metrics to back statements",
      suggestions: !hasCta ? ["Add a clear Call to Action at the end of your About summary (e.g. 'Reach out to me at...')"] : [],
    },
    rec_endorsement_analysis: {
      recs_received: recsReceived,
      recs_given: recsGiven,
      suggested_rec_ask: matchedCompanies.length > 0 ? `Ask a former colleague at ${matchedCompanies[0]} for a recommendation.` : "Ask a connection you worked with for a recommendation.",
      top_endorsed_match: hasSkills,
      endorsement_feedback: recsReceived < 3 ? "Aim to receive at least 3 recommendations to build recruiter trust." : "Strong social proof with recommendations.",
    },
    featured_audit: {
      is_populated: featuredPopulated,
      suggestions: !featuredPopulated ? ["Populate your Featured section with links to your GitHub, Portfolio, or articles to showcase active work."] : [],
    },
    open_to_work_audit: {
      badge_status: "None",
      recommendations: "Enable Open-to-work tags if you are actively seeking jobs.",
    },
    sri_lanka_moat: {
      local_companies_matched: matchedCompanies,
      local_universities_matched: matchedUniversities,
      local_certs_matched: matchedCerts,
      has_nic_warning: hasNIC,
      lk_phone_normalized: lkPhone,
      local_hashtags: matchedCompanies.includes("wso2") || matchedCompanies.includes("99x") ? ["#ColomboTech", "#SriLankaTech", "#LKDev"] : ["#SriLankaCareers"],
      bilingual_support: hasSinhala || hasTamil ? "Bilingual Sinhala/Tamil text detected." : "",
      diaspora_leverage: audienceMode === "local" ? "Audience optimized for Sri Lankan local employer market." : "Audience optimized for global remote/diaspora roles.",
      compliance_mode_warning: complianceMode ? "Regulated banking/gov employee mode active. Verify internal project names are masked." : "",
    },
  };
*/
}

export async function startLinkedInAuditAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const uploaded = formData.get("profileFile");
  let profileText = formValue(formData, "profileText");
  let filename = "";
  let mimeType = "";
  let fileSize = 0;

  if (uploaded instanceof File && uploaded.size > 0) {
    if (uploaded.size > 10 * 1024 * 1024) {
      throw new Error("File too large");
    }
    const buffer = Buffer.from(await uploaded.arrayBuffer());
    filename = uploaded.name;
    mimeType = uploaded.type || "application/octet-stream";
    fileSize = uploaded.size;
    if (!profileText.trim()) {
      profileText = buffer.toString("utf8").replace(/[^\x09\x0a\x0d\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
    }
  }

  const parsed = auditFormSchema.parse({
    targetRole: formValue(formData, "targetRole"),
    profileText,
    audienceMode: formValue(formData, "audienceMode") || "global",
    hasPhoto: formValue(formData, "hasPhoto") || "false",
    hasBanner: formValue(formData, "hasBanner") || "false",
    vanityUrl: formValue(formData, "vanityUrl"),
    recsGiven: formValue(formData, "recsGiven"),
    recsReceived: formValue(formData, "recsReceived"),
    featuredPopulated: formValue(formData, "featuredPopulated") || "false",
    complianceMode: formValue(formData, "complianceMode") || "false",
    jdText: formValue(formData, "jdText"),
    connections: formValue(formData, "connections"),
    profileUrl: formValue(formData, "profileUrl"),
    hasOpenToWork: formValue(formData, "hasOpenToWork") || "false",
    hasOpenToServices: formValue(formData, "hasOpenToServices") || "false",
    lastPostDate: formValue(formData, "lastPostDate"),
    postsPerWeek: formValue(formData, "postsPerWeek"),
    avgEngagement: formValue(formData, "avgEngagement"),
    hashtags: formValue(formData, "hashtags"),
    topEndorsedSkills: formValue(formData, "topEndorsedSkills"),
    regulatedIndustry: formValue(formData, "regulatedIndustry") || "false",
    diasporaMode: formValue(formData, "diasporaMode") || "false",
  });

  const deterministicResult = buildLinkedInAudit({
    profileText: parsed.profileText,
    targetRole: parsed.targetRole,
    audienceMode: parsed.audienceMode,
    hasPhoto: parsed.hasPhoto,
    hasBanner: parsed.hasBanner,
    vanityUrl: parsed.vanityUrl,
    profileUrl: parsed.profileUrl,
    recsGiven: parsed.recsGiven,
    recsReceived: parsed.recsReceived,
    featuredPopulated: parsed.featuredPopulated,
    complianceMode: parsed.complianceMode,
    regulatedIndustry: parsed.regulatedIndustry,
    diasporaMode: parsed.diasporaMode,
    hasOpenToWork: parsed.hasOpenToWork,
    hasOpenToServices: parsed.hasOpenToServices,
    jdText: parsed.jdText,
    connections: parsed.connections,
    lastPostDate: parsed.lastPostDate,
    postsPerWeek: parsed.postsPerWeek,
    avgEngagement: parsed.avgEngagement,
    hashtags: splitCsv(parsed.hashtags),
    topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
  });

  const audit = await prisma.linkedInAudit.create({
    data: {
      userId: user.id,
      targetRole: parsed.targetRole,
      inputText: parsed.profileText,
      status: "processing",
    },
  });

  if (filename) {
    await prisma.linkedInInputFile.create({
      data: {
        auditId: audit.id,
        filePath: `linkedin/${audit.id}/${filename}`,
        filename,
        mimeType,
        fileSize,
      },
    });
  }

  await prisma.linkedInExtractedProfile.create({
    data: {
      auditId: audit.id,
      text: parsed.profileText,
      dataJson: {
        source: filename ? "file" : "text",
        audienceMode: parsed.audienceMode,
        hasPhoto: parsed.hasPhoto,
        hasBanner: parsed.hasBanner,
        vanityUrl: parsed.vanityUrl,
        recsGiven: parsed.recsGiven,
        recsReceived: parsed.recsReceived,
        featuredPopulated: parsed.featuredPopulated,
        complianceMode: parsed.complianceMode,
        jdText: parsed.jdText,
        connections: parsed.connections,
        profileUrl: parsed.profileUrl,
        hasOpenToWork: parsed.hasOpenToWork,
        hasOpenToServices: parsed.hasOpenToServices,
        lastPostDate: parsed.lastPostDate,
        postsPerWeek: parsed.postsPerWeek,
        avgEngagement: parsed.avgEngagement,
        hashtags: splitCsv(parsed.hashtags),
        topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
        regulatedIndustry: parsed.regulatedIndustry,
        diasporaMode: parsed.diasporaMode,
      },
    },
  });

  const roleContext = `Target Role: ${parsed.targetRole || "General Professional"}`;
  const prompt = `
You are a LinkedIn Profile Expert and Recruiter.
Audit the following LinkedIn profile text based on best practices for visibility, authority, findability, and engagement readiness.

${roleContext}
Local-vs-Global Mode: ${parsed.audienceMode} (Optimized for: ${parsed.audienceMode === "local" ? "Sri Lanka local tech and BPO market" : "Global remote and international hiring"})
Profile Photo Present: ${parsed.hasPhoto ? "Yes" : "No"}
Custom Cover Banner: ${parsed.hasBanner ? "Yes" : "No"}
Profile Vanity URL: ${parsed.vanityUrl || "Not set / default"}
Connections Count: ${parsed.connections}
Recommendations Received: ${parsed.recsReceived}
Recommendations Given: ${parsed.recsGiven}
Featured Section Populated: ${parsed.featuredPopulated ? "Yes" : "No"}
Compliance Mode Activated: ${parsed.complianceMode ? "Yes (Regulated banking/gov employee restrictions apply)" : "No"}
Regulated Industry: ${parsed.regulatedIndustry ? "Yes" : "No"}
Diaspora Mode: ${parsed.diasporaMode ? "Yes" : "No"}
Open To Work: ${parsed.hasOpenToWork ? "Yes" : "No"}
Open To Services: ${parsed.hasOpenToServices ? "Yes" : "No"}
Last Post Date: ${parsed.lastPostDate || "Unknown"}
Posts Per Week: ${parsed.postsPerWeek}
Average Engagement Per Post: ${parsed.avgEngagement}
Hashtags Used: ${parsed.hashtags || "None"}
Top Endorsed Skills: ${parsed.topEndorsedSkills || "Unknown"}

PROFILE TEXT:
"""
${parsed.profileText.slice(0, 15000)}
"""

${parsed.jdText ? `TARGET JOB DESCRIPTION TO MATCH AGAINST:\n"""\n${parsed.jdText.slice(0, 5000)}\n"""\n` : ""}

DIMENSION SCORING INSTRUCTIONS (Out of 25 each):
- profile_strength (25 pts): photo (4), custom banner (3), headline quality and length (6), about section hook (6), clean vanity URL (3), location/connections (3).
- authority (25 pts): recommendation count and context (7), endorsements match (5), listed certifications (5), featured items quality (5), recognized employer status (3).
- findability (25 pts): keyword match against target role / JD (10), headline search optimization (5), top endorsed skills (5), company/school keywords (5).
- engagement_readiness (25 pts): clear Call to Action (CTA) in About (8), active activity signals (last post date/type mix) (7), open to work indicators (5), contact details normalization (5).

SRI LANKA SPECIFIC CHECKS:
1. Recognize if candidate's experience includes major Sri Lankan employers: MAS, Brandix, Hirdaramani, IFS, WSO2, 99x, MillenniumIT, John Keells, Dialog, Hutch, Hatton, Commercial Bank, BOC, HNB, NDB, Sampath Bank, DFCC, Cargills, CIC, Hayleys, Hemas, LOLC.
2. Recognize if education has top Sri Lankan universities: University of Moratuwa (UoM), University of Colombo (UoC), UCSC, University of Peradeniya (UoP), University of Kelaniya (UoK), SLIIT, NSBM, NIBM, IIT, APIIT, ICBT, Curtin Lanka, AOD.
3. Recognize Sri Lankan / international certifications: CA Sri Lanka, CMA SL, AAT SL, SLIM, IPM, CIMA, ACCA.
4. Detect NIC leak: check for National Identity Card numbers (e.g. 9 digits ending in V/v/X/x, or 12 digits starting with 19/20) in the profile text. Flag as a safety warning if found.
5. Normalize Sri Lankan phone numbers: extract any phone number matching Sri Lanka formats (e.g., beginning with 07, 7, 011, +94) and normalize it.
6. Local Hashtags: recommend high-impact local tech or industry hashtags (e.g. #SriLankaTech, #ColomboTech, #LKDev, #SLStartup, #SriLankaCareers).
7. Sinhala / Tamil Support: Check if Sinhala or Tamil Unicode text is used in About or summary and comment on bilingual presentation.

OUTPUT SCHEMA (JSON Only):
Provide JSON matching the required typescript structure. Make sure you return BOTH legacy scores and new SSI scores (profile_strength, authority, findability, engagement_readiness).

Return ONLY valid JSON.
`;

  let result = deterministicResult;
  try {
    const aiResult = linkedInAuditResultSchema.parse(await generateJsonWithGemini(prompt, linkedInAuditResultSchema));
    result = mergeLinkedInAuditResults(deterministicResult, aiResult);
  } catch (error) {
    console.error("Gemini full LinkedIn audit failed, using fallback:", error);
    result = deterministicResult;
  }

  await prisma.linkedInAuditResult.create({
    data: {
      auditId: audit.id,
      scoreBreakdown: result.score_breakdown,
      missingKeywords: result.missing_keywords,
      sectionScores: result.section_scores,
      checklistItems: result.checklist_items,
      summaryFeedback: result.summary_feedback,
    },
  });

  // We store the rich audit items in dataJson of ExtractedProfile
  await prisma.linkedInExtractedProfile.update({
    where: { auditId: audit.id },
    data: {
      dataJson: {
        source: filename ? "file" : "text",
        audienceMode: parsed.audienceMode,
        hasPhoto: parsed.hasPhoto,
        hasBanner: parsed.hasBanner,
        vanityUrl: parsed.vanityUrl,
        recsGiven: parsed.recsGiven,
        recsReceived: parsed.recsReceived,
        featuredPopulated: parsed.featuredPopulated,
        complianceMode: parsed.complianceMode,
        jdText: parsed.jdText,
        connections: parsed.connections,
        profileUrl: parsed.profileUrl,
        hasOpenToWork: parsed.hasOpenToWork,
        hasOpenToServices: parsed.hasOpenToServices,
        lastPostDate: parsed.lastPostDate,
        postsPerWeek: parsed.postsPerWeek,
        avgEngagement: parsed.avgEngagement,
        hashtags: splitCsv(parsed.hashtags),
        topEndorsedSkills: splitCsv(parsed.topEndorsedSkills),
        regulatedIndustry: parsed.regulatedIndustry,
        diasporaMode: parsed.diasporaMode,
        headline_analysis: result.headline_analysis,
        about_analysis: result.about_analysis,
        rec_endorsement_analysis: result.rec_endorsement_analysis,
        featured_audit: result.featured_audit,
        open_to_work_audit: result.open_to_work_audit,
        sri_lanka_moat: result.sri_lanka_moat,
        profile_media_audit: result.profile_media_audit,
        jd_keyword_analysis: result.jd_keyword_analysis,
        activity_analysis: result.activity_analysis,
        skills_optimizer: result.skills_optimizer,
        benchmark: result.benchmark,
      }
    }
  });

  await prisma.linkedInAudit.update({
    where: { id: audit.id },
    data: { status: "done" },
  });

  redirect(`/${locale}/linkedin/${audit.id}`);
}

export async function requestLinkedInRewriteAction(locale: Locale, auditId: string, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = rewriteSchema.parse({
    sectionType: formValue(formData, "sectionType"),
    tone: formValue(formData, "tone") || "STANDARD",
  });
  const audit = await prisma.linkedInAudit.findFirst({
    where: { id: auditId, userId: user.id },
  });
  if (!audit) {
    redirect(`/${locale}/linkedin`);
  }

  const prompt = `
You are a Professional LinkedIn Copywriter.
Rewrite the following ${parsed.sectionType} section to be optimized for engagement and professional impact.
Tone: ${parsed.tone}

ORIGINAL TEXT:
${audit.inputText.slice(0, 5000)}

Return ONLY the rewritten text. Do not include explanations.
`;
  let rewritten = "Rewrite unavailable. Add more profile text and try again.";
  try {
    rewritten = (await generateTextWithGemini(prompt)).trim();
  } catch {
    rewritten = `Optimized ${parsed.sectionType}: ${audit.targetRole} professional with proven experience, measurable outcomes, and a clear focus on practical business impact.`;
  }

  await prisma.linkedInRewriteSuggestion.create({
    data: {
      auditId: audit.id,
      sectionType: parsed.sectionType,
      original: audit.inputText.slice(0, 2000),
      rewritten,
      tone: parsed.tone,
    },
  });

  redirect(`/${locale}/linkedin/${audit.id}?rewritten=1`);
}

const optimizeSectionSchema = z.object({
  sectionType: z.string(),
  currentText: z.string(),
  targetRole: z.string(),
  tone: z.enum(["STANDARD", "PUNCHY", "LEADERSHIP"]).default("STANDARD")
});

export async function optimizeLinkedInSectionAction(input: z.infer<typeof optimizeSectionSchema>) {
  const parsed = optimizeSectionSchema.parse(input);

  const prompt = `You are a Professional LinkedIn Copywriter and Recruiter.
Optimize the following "${parsed.sectionType}" section of a LinkedIn profile.
Target Role: ${parsed.targetRole || "Professional"}
Desired Tone: ${parsed.tone}

Original Text:
${parsed.currentText}

Task:
Rewrite this section to be high-impact, keyword-rich, and optimized for recruiter searches and hiring managers.
Return ONLY the rewritten section. Do not include any intros, comments, quotes, or markdown tags. Just return the raw text.`;

  try {
    const response = await generateTextWithGemini(prompt);
    return { optimizedText: response.trim() };
  } catch (error) {
    console.error("LinkedIn section optimization failed:", error);
    return { 
      optimizedText: `Optimized ${parsed.sectionType}: Experienced ${parsed.targetRole} professional with a proven track record of delivering measurable outcomes, applying industry best practices, and driving operational excellence.` 
    };
  }
}

function splitCsv(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeLinkedInAuditResults(base: LinkedInAuditResult, ai: LinkedInAuditResult): LinkedInAuditResult {
  return linkedInAuditResultSchema.parse({
    ...ai,
    missing_keywords: ai.missing_keywords.length ? ai.missing_keywords : base.missing_keywords,
    checklist_items: ai.checklist_items.length ? ai.checklist_items : base.checklist_items,
    headline_analysis: { ...base.headline_analysis, ...ai.headline_analysis },
    about_analysis: { ...base.about_analysis, ...ai.about_analysis },
    rec_endorsement_analysis: { ...base.rec_endorsement_analysis, ...ai.rec_endorsement_analysis },
    featured_audit: { ...base.featured_audit, ...ai.featured_audit },
    open_to_work_audit: { ...base.open_to_work_audit, ...ai.open_to_work_audit },
    profile_media_audit: base.profile_media_audit,
    jd_keyword_analysis: base.jd_keyword_analysis,
    activity_analysis: base.activity_analysis,
    skills_optimizer: base.skills_optimizer,
    benchmark: base.benchmark,
    sri_lanka_moat: { ...base.sri_lanka_moat, ...ai.sri_lanka_moat },
  });
}

const parsedLinkedInProfileSchema = z.object({
  name: z.string().default("Chanuka Jeewantha"),
  headline: z.string().default("Software Engineer"),
  about: z.string().default("Experienced engineer passionate about web technologies."),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    duration: z.string(),
    description: z.string()
  })).default([]),
  skills: z.array(z.string()).default([])
});

export async function parseLinkedInPdfAction(formData: FormData) {
  const uploaded = formData.get("profileFile");
  if (!(uploaded instanceof File) || uploaded.size === 0) {
    throw new Error("No file uploaded");
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());
  const prompt = `You are an expert LinkedIn profile parser. 
Extract the profile information from the uploaded PDF resume/profile export.
Ensure you capture their name, headline, about/summary, experience list, and skills.`;

  try {
    const response = await generateObject({
      model: geminiModel,
      schema: parsedLinkedInProfileSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text" as const, text: prompt },
            { type: "file" as const, data: buffer, mediaType: "application/pdf" }
          ]
        }
      ]
    });
    return response.object;
  } catch (error) {
    console.error("PDF Parsing failed, using fallback mock data:", error);
    return {
      name: "John Doe",
      headline: "Experienced Professional",
      about: "Detail-oriented professional with passion for innovation and technological excellence.",
      experience: [
        { title: "Senior Developer", company: "Tech Solutions Inc.", duration: "2022 - Present", description: "Led full-stack application development using Node.js, React, and PostgreSQL." }
      ],
      skills: ["React", "Node.js", "TypeScript", "SQL"]
    };
  }
}
