import { addDays, differenceInCalendarDays, formatISO } from "date-fns";

import { extractJdKeywords } from "@/lib/ats-scoring";
import { normalizeLkPhone } from "@/lib/phone";
import { slCertifications, slCompanies, slUniversities } from "@/lib/sl-data";
import type { LinkedInAuditResult } from "@/lib/linkedin-audit";

export type LinkedInAudienceMode = "local" | "global";

export type LinkedInAnalysisInput = {
  profileText: string;
  targetRole: string;
  audienceMode: LinkedInAudienceMode;
  hasPhoto: boolean;
  hasBanner: boolean;
  vanityUrl: string;
  profileUrl?: string;
  recsGiven: number;
  recsReceived: number;
  featuredPopulated: boolean;
  complianceMode: boolean;
  regulatedIndustry: boolean;
  diasporaMode: boolean;
  hasOpenToWork: boolean;
  hasOpenToServices: boolean;
  jdText: string;
  connections: number;
  lastPostDate: string;
  postsPerWeek: number;
  avgEngagement: number;
  hashtags: string[];
  topEndorsedSkills: string[];
};

const stopWords = new Set([
  "about", "after", "and", "are", "because", "been", "being", "candidate", "company", "from", "have",
  "into", "that", "their", "this", "with", "will", "work", "your", "role", "team", "teams", "skills",
  "requirements", "experience", "responsibilities", "preferred", "ability", "strong", "excellent",
]);

const hardSkillHints = [
  "typescript", "javascript", "react", "next.js", "node.js", "python", "django", "sql", "postgresql", "aws",
  "azure", "docker", "kubernetes", "power bi", "excel", "figma", "prisma", "tailwind", "java", "c#",
  "analytics", "seo", "salesforce", "aml", "kyc", "aht", "fcr", "csat", "revpar", "adr", "aql",
];

const softSkillHints = [
  "communication", "leadership", "collaboration", "stakeholder management", "problem solving", "mentoring",
  "negotiation", "customer service", "adaptability", "critical thinking", "time management",
];

const toolHints = [
  "jira", "github", "gitlab", "notion", "figma", "tableau", "power bi", "excel", "salesforce", "hubspot",
  "postgresql", "mysql", "mongodb", "aws", "azure", "gcp", "docker", "kubernetes",
];

const industryKeywordPacks: Record<string, string[]> = {
  bpo: ["voice ops", "AHT", "FCR", "CSAT", "Six Sigma", "queue management", "quality assurance"],
  apparel: ["line balancing", "cut order plan", "AQL", "operational excellence", "costing", "merchandising"],
  tourism: ["front office", "F&B", "RevPAR", "ADR", "OTAs", "guest experience"],
  banking: ["KYC", "AML", "CASA", "NPL", "trade finance", "treasury", "risk controls"],
  tech: ["cloud", "full-stack", "API design", "DevOps", "ColomboTech", "product engineering"],
};

const slHashtags: Record<string, string[]> = {
  tech: ["#SriLankaTech", "#ColomboTech", "#LKDev", "#SLStartup"],
  bpo: ["#ITLK", "#SLITServices", "#SriLankaCareers"],
  apparel: ["#SriLankaApparel", "#MASLife", "#BrandixLife"],
  tourism: ["#VisitSriLanka", "#SoSriLanka", "#ExploreCeylon"],
  banking: ["#LKBanking", "#BankingLK", "#SriLankaCareers"],
  general: ["#SriLankaCareers", "#YouthLK", "#LKWomenInTech"],
};

export function extractStructuredJdKeywords(jdText: string, targetRole = "") {
  const text = `${targetRole}\n${jdText}`.toLowerCase();
  const extracted = extractJdKeywords(jdText || targetRole, 35);
  const pick = (library: string[]) => library.filter((item) => text.includes(item.toLowerCase()));

  const hard = new Set([...pick(hardSkillHints), ...extracted.filter((keyword) => hardSkillHints.includes(keyword.toLowerCase()))]);
  const soft = new Set([...pick(softSkillHints), ...extracted.filter((keyword) => softSkillHints.includes(keyword.toLowerCase()))]);
  const tools = new Set([...pick(toolHints), ...extracted.filter((keyword) => toolHints.includes(keyword.toLowerCase()))]);
  const certs = new Set(slCertifications.filter((cert) => text.includes(cert.toLowerCase())));

  for (const keyword of extracted) {
    if (hard.size + soft.size + tools.size >= 24) break;
    if (!stopWords.has(keyword) && keyword.length > 3 && !keyword.includes(" ")) {
      hard.add(titleCase(keyword));
    }
  }

  return {
    hard_skills: [...hard].slice(0, 14).map(titleCase),
    soft_skills: [...soft].slice(0, 8).map(titleCase),
    certifications: [...certs].slice(0, 8),
    tools: [...tools].slice(0, 10).map(titleCase),
    seniority: /lead|principal|head|director|executive/i.test(text)
      ? "Lead"
      : /senior|sr\./i.test(text)
        ? "Senior"
        : /intern|trainee|associate|junior/i.test(text)
          ? "Entry"
          : "Mid",
  };
}

export function buildLinkedInAudit(input: LinkedInAnalysisInput): LinkedInAuditResult {
  const text = input.profileText;
  const lower = text.toLowerCase();
  const headline = extractLabel(text, "Headline") || text.split("\n").find((line) => line.trim().length >= 30 && line.trim().length <= 220) || input.targetRole;
  const about = extractAbout(text);
  const jdKeywords = extractStructuredJdKeywords(input.jdText, input.targetRole);
  const allJdKeywords = [
    ...jdKeywords.hard_skills.map((keyword) => ({ keyword, weight: 3, type: "hard" as const })),
    ...jdKeywords.tools.map((keyword) => ({ keyword, weight: 3, type: "tool" as const })),
    ...jdKeywords.certifications.map((keyword) => ({ keyword, weight: 3, type: "cert" as const })),
    ...jdKeywords.soft_skills.map((keyword) => ({ keyword, weight: 1, type: "soft" as const })),
  ];
  const matchedKeywords = allJdKeywords.filter(({ keyword }) => lower.includes(keyword.toLowerCase()));
  const totalWeight = allJdKeywords.reduce((sum, item) => sum + item.weight, 0) || 1;
  const matchedWeight = matchedKeywords.reduce((sum, item) => sum + item.weight, 0);
  const jdMatchScore = Math.round((matchedWeight / totalWeight) * 100);

  const localCompanies = matchKnownNames(slCompanies, lower);
  const localUniversities = matchKnownNames(slUniversities, lower);
  const localCerts = matchKnownNames(slCertifications, lower);
  const recognizedIndustry = inferIndustry(lower);
  const localHashtags = slHashtags[recognizedIndustry] ?? slHashtags.general;
  const industryPack = industryKeywordPacks[recognizedIndustry] ?? industryKeywordPacks.tech;

  const headlineAnalysis = analyzeHeadline(headline, jdKeywords.hard_skills);
  const aboutAnalysis = analyzeAbout(about || text);
  const phone = findLkPhone(text);
  const hasNIC = /\b(?:\d{9}[VvXx]|\d{12})\b/.test(text);
  const lastPostDaysAgo = input.lastPostDate ? Math.max(0, differenceInCalendarDays(new Date(), new Date(input.lastPostDate))) : 999;
  const hashtagFeedback = analyzeHashtags(input.hashtags, localHashtags);
  const skillSuggestions = Array.from(new Set([...jdKeywords.hard_skills, ...jdKeywords.tools, ...industryPack])).slice(0, 18);
  const topSkills = input.topEndorsedSkills.length ? input.topEndorsedSkills : extractSkills(text).slice(0, 3);
  const mismatchedTopSkills = topSkills.filter((skill) => !skillSuggestions.some((suggested) => sameKeyword(skill, suggested)));

  let profileStrength = 8;
  if (input.hasPhoto) profileStrength += 4;
  if (input.hasBanner) profileStrength += 3;
  if (headlineAnalysis.char_count >= 40 && headlineAnalysis.char_count <= 220) profileStrength += 4;
  if (aboutAnalysis.first_220_hook_strength >= 70) profileStrength += 3;
  if (isCleanVanityUrl(input.vanityUrl)) profileStrength += 3;

  let authority = 6;
  authority += Math.min(7, input.recsReceived * 2);
  authority += input.recsGiven > 0 ? 3 : 0;
  authority += input.featuredPopulated ? 5 : 0;
  authority += Math.min(5, localCerts.length * 2);
  authority += localCompanies.length ? 3 : 0;

  let findability = 6;
  findability += Math.min(10, Math.round(jdMatchScore / 10));
  findability += headlineAnalysis.has_value_prop ? 3 : 0;
  findability += topSkills.length >= 3 && mismatchedTopSkills.length === 0 ? 3 : 0;
  findability += localCompanies.length || localUniversities.length ? 3 : 0;

  let engagement = 6;
  engagement += aboutAnalysis.has_cta ? 5 : 0;
  engagement += lastPostDaysAgo <= 30 ? 4 : 0;
  engagement += input.hasOpenToWork || input.hasOpenToServices ? 3 : 0;
  engagement += phone ? 3 : 0;
  engagement += input.postsPerWeek >= 1 ? 4 : 0;

  const profileStrengthScore = Math.min(25, profileStrength);
  const authorityScore = Math.min(25, authority);
  const findabilityScore = Math.min(25, findability);
  const engagementScore = Math.min(25, engagement);
  const missingHard = allJdKeywords.filter((item) => item.type === "hard" && !matchedKeywords.includes(item)).map((item) => item.keyword);
  const missingSoft = allJdKeywords.filter((item) => item.type === "soft" && !matchedKeywords.includes(item)).map((item) => item.keyword);
  const missingTools = allJdKeywords.filter((item) => item.type === "tool" && !matchedKeywords.includes(item)).map((item) => item.keyword);
  const missingCerts = allJdKeywords.filter((item) => item.type === "cert" && !matchedKeywords.includes(item)).map((item) => item.keyword);
  const placementHints = [
    ...missingHard.slice(0, 4).map((keyword) => ({ keyword, priority: "HIGH", placement: "Headline, Skills, and Experience bullets" })),
    ...missingTools.slice(0, 3).map((keyword) => ({ keyword, priority: "HIGH", placement: "Skills and Featured project descriptions" })),
    ...missingSoft.slice(0, 3).map((keyword) => ({ keyword, priority: "MEDIUM", placement: "About second paragraph" })),
    ...missingCerts.slice(0, 2).map((keyword) => ({ keyword, priority: "HIGH", placement: "Licenses & Certifications" })),
  ];

  return {
    score_breakdown: {
      completeness: profileStrengthScore * 4,
      keywords: findabilityScore * 4,
      readability: aboutAnalysis.first_220_hook_strength,
      impact: authorityScore * 4,
      consistency: 80,
      recruiter_findability: findabilityScore * 4,
      profile_strength: profileStrengthScore,
      authority: authorityScore,
      findability: findabilityScore,
      engagement_readiness: engagementScore,
    },
    missing_keywords: placementHints.length ? placementHints : [{ keyword: input.targetRole, priority: "MEDIUM", placement: "Headline and About" }],
    section_scores: {
      headline: Math.round(profileStrengthScore / 2.5),
      about: Math.round(aboutAnalysis.first_220_hook_strength / 10),
      experience: Math.round(authorityScore / 2.5),
      skills: Math.round(findabilityScore / 2.5),
      education: localUniversities.length ? 9 : 6,
    },
    checklist_items: [
      { id: "photo", label: "Professional profile photo visible", completed: input.hasPhoto, impact: "HIGH" },
      { id: "banner", label: "Custom cover banner uploaded", completed: input.hasBanner, impact: "MEDIUM" },
      { id: "vanity", label: "Clean vanity URL setup", completed: isCleanVanityUrl(input.vanityUrl), impact: "MEDIUM" },
      { id: "recs", label: "Has target recommendation count", completed: input.recsReceived >= (jdKeywords.seniority === "Entry" ? 1 : 3), impact: "HIGH" },
      { id: "featured", label: "Featured section populated", completed: input.featuredPopulated, impact: "HIGH" },
      { id: "activity", label: "Posted or commented in the last 30 days", completed: lastPostDaysAgo <= 30, impact: "MEDIUM" },
      { id: "nic", label: "NIC numbers masked from public profile", completed: !hasNIC, impact: "HIGH" },
    ],
    summary_feedback: `Profile is ${scoreLabel(profileStrengthScore + authorityScore + findabilityScore + engagementScore).toLowerCase()}. Improve the highest-impact gaps first: headline SEO, first 220 About characters, recommendations, and recent activity.`,
    headline_analysis: headlineAnalysis,
    about_analysis: aboutAnalysis,
    rec_endorsement_analysis: {
      recs_received: input.recsReceived,
      recs_given: input.recsGiven,
      suggested_rec_ask: localCompanies.length
        ? `Ask a former colleague at ${localCompanies[0]} for a recommendation that mentions ${skillSuggestions.slice(0, 2).join(" and ")}.`
        : "Ask a recent manager, project lead, or client for a recommendation tied to one measurable outcome.",
      top_endorsed_match: mismatchedTopSkills.length === 0,
      endorsement_feedback: mismatchedTopSkills.length
        ? `Top endorsed skills should match the target role. Review: ${mismatchedTopSkills.join(", ")}.`
        : input.recsReceived >= 3
          ? "Strong social proof. Keep the top three endorsed skills aligned with the target role."
          : "Aim for at least 3 recommendations for senior profiles and 1 for junior profiles.",
    },
    featured_audit: {
      is_populated: input.featuredPopulated,
      suggestions: input.featuredPopulated
        ? ["Rotate Featured items quarterly so the first card matches your current target role."]
        : ["Add your best portfolio link, GitHub repo, published article, certification badge, or high-performing post."],
    },
    open_to_work_audit: {
      badge_status: input.hasOpenToWork ? "Open to Work" : input.hasOpenToServices ? "Open to Services" : "None",
      recommendations: input.hasOpenToWork
        ? "Use recruiter-only visibility if you are currently employed."
        : "Turn on Open-to-work or Open-to-services if you are actively seeking opportunities.",
    },
    profile_media_audit: {
      photo_present: input.hasPhoto,
      photo_score: input.hasPhoto ? 80 : 20,
      photo_feedback: input.hasPhoto
        ? ["Photo is present. For best results, use a centered face, clean background, eye contact, and good lighting."]
        : ["Add a professional profile photo. LinkedIn is photo-first for both local and global audiences."],
      banner_present: input.hasBanner,
      banner_score: input.hasBanner ? 75 : 20,
      banner_feedback: input.hasBanner
        ? ["Banner is custom. Keep it readable at 1584x396 and aligned to your role or industry."]
        : ["Replace the default banner with a role-specific visual: portfolio, industry, product, or credibility signal."],
      vanity_url_clean: isCleanVanityUrl(input.vanityUrl),
      public_visibility_detected: Boolean(input.profileUrl || input.vanityUrl),
    },
    jd_keyword_analysis: {
      extracted: jdKeywords,
      match_score: jdMatchScore,
      matched_keywords: matchedKeywords.map((item) => item.keyword),
      missing_hard_skills: missingHard,
      missing_soft_skills: missingSoft,
      missing_tools: missingTools,
      missing_certifications: missingCerts,
      placement_hints: placementHints,
    },
    activity_analysis: {
      posts_per_week: input.postsPerWeek,
      last_post_days_ago: lastPostDaysAgo,
      cadence_label: input.postsPerWeek >= 1 && lastPostDaysAgo <= 30
        ? "Healthy posting cadence"
        : lastPostDaysAgo <= 30
          ? "Recently active, but cadence is light"
          : "Inactive profile. Add one thoughtful post or comment this week.",
      engagement_score: Math.min(100, Math.round(input.avgEngagement * 5 + input.postsPerWeek * 20)),
      hashtag_feedback: hashtagFeedback,
      best_time_to_post: input.audienceMode === "local"
        ? "SL recruiters are usually most active Mon-Wed 9-11am SLT and 7-9pm SLT."
        : "Test weekday mornings in your target market timezone and reuse the same slot for 3 weeks.",
      post_ideas: buildPostIdeas(input.targetRole, recognizedIndustry, skillSuggestions),
      comment_templates: [
        "This matches what I have seen in [industry]. The practical challenge is usually [specific constraint].",
        "Strong point. One extra angle I would add is how this affects [customer/team/business outcome].",
        "Useful breakdown. In Sri Lanka, I have noticed [local context] changes how teams approach this.",
      ],
    },
    skills_optimizer: {
      suggested_skills: skillSuggestions,
      top_endorsed_skills: topSkills,
      mismatched_top_skills: mismatchedTopSkills,
      boolean_search_examples: buildBooleanSearches(input.targetRole, skillSuggestions, input.audienceMode),
    },
    benchmark: {
      peer_label: `${input.targetRole || "Professionals"} ${input.audienceMode === "local" ? "in Sri Lanka" : "globally"}`,
      strengths: [
        input.hasPhoto ? "Profile photo present" : "",
        input.featuredPopulated ? "Featured section populated" : "",
        localCompanies.length ? `Recognized SL employer signal: ${localCompanies.slice(0, 2).join(", ")}` : "",
      ].filter(Boolean),
      gaps: [
        input.recsReceived < 3 ? "Top profiles usually show 3+ recommendations" : "",
        topSkills.length < 10 ? "Top profiles usually list 10-20 role-relevant skills" : "",
        lastPostDaysAgo > 30 ? "Top profiles have visible activity within 30 days" : "",
      ].filter(Boolean),
      progress_next_steps: [
        "Rewrite headline with one target-role keyword and one outcome.",
        "Strengthen the first 220 About characters before the LinkedIn see-more cutoff.",
        "Ask one recent collaborator for a recommendation this week.",
      ],
      reaudit_recommended_on: formatISO(addDays(new Date(), 30), { representation: "date" }),
    },
    sri_lanka_moat: {
      local_companies_matched: localCompanies,
      local_universities_matched: localUniversities,
      local_certs_matched: localCerts,
      has_nic_warning: hasNIC,
      lk_phone_normalized: phone ? normalizeLkPhone(phone) : "",
      local_hashtags: localHashtags,
      bilingual_support: /[\u0D80-\u0DFF]/.test(text)
        ? "Sinhala text detected. Return bilingual rewrites for local audience posts."
        : /[\u0B80-\u0BFF]/.test(text)
          ? "Tamil text detected. Return bilingual rewrites for local audience posts."
          : "English profile detected. Add Sinhala/Tamil posts only when targeting local community engagement.",
      diaspora_leverage: input.diasporaMode
        ? "Diaspora mode active: emphasize Sri Lankan roots, global delivery, timezone overlap, and return-to-SL credibility."
        : input.audienceMode === "local"
          ? "Audience optimized for Sri Lankan local employer and recruiter signals."
          : "Audience optimized for global remote and international hiring.",
      compliance_mode_warning: input.complianceMode || input.regulatedIndustry
        ? "Compliance-aware mode active. Avoid internal bank/gov data, specific deal names, customer data, and political claims."
        : "",
      audience_mode: input.audienceMode,
      recruiter_activity_window: "Mon-Wed 9-11am SLT and 7-9pm SLT",
      industry_keyword_pack: industryPack,
      alumni_leverage: localUniversities.length
        ? `Use ${localUniversities[0]} alumni search to find warm paths into target companies.`
        : "Add education details to unlock alumni leverage suggestions.",
      holiday_posting_note: "Around Avurudu, Vesak, and Tamil New Year, schedule practical career posts before the holiday week or make them culturally relevant.",
    },
  };
}

function analyzeHeadline(headline: string, keywords: string[]) {
  const lower = headline.toLowerCase();
  const charCount = headline.length;
  const hasValueProp = /\b(help|build|deliver|solve|create|lead|grow|improve|optimi[sz]e|for)\b/i.test(headline);
  const hasMetrics = /\d+%|\d+x|\d+\+|lkr|usd|award|certified/i.test(headline);
  const keywordHits = keywords.filter((keyword) => lower.includes(keyword.toLowerCase())).length;
  const suggestions = [
    charCount < 40 ? "Headline is too short; include role, specialty, and value." : "",
    charCount > 220 ? "Headline exceeds LinkedIn's 220 character limit." : "",
    charCount > 70 ? "The strongest words should appear in the first 70 characters for mobile preview." : "",
    !hasValueProp ? "Add who you help or the outcome you deliver." : "",
    keywordHits < 2 && keywords.length ? "Add 1-2 target-role keywords recruiters search for." : "",
  ].filter(Boolean);

  return {
    char_count: charCount,
    hook_strength_score: Math.min(100, 35 + (hasValueProp ? 25 : 0) + (hasMetrics ? 15 : 0) + Math.min(25, keywordHits * 12)),
    has_value_prop: hasValueProp,
    has_outcome_metrics: hasMetrics,
    format_type: /\|/.test(headline) ? "Title | Specialty | Company" : /\bi help\b/i.test(headline) ? "I help X do Y" : "Role-led headline",
    mobile_visible: charCount <= 70,
    suggestions: suggestions.slice(0, 3),
  };
}

function analyzeAbout(about: string) {
  const first220 = about.slice(0, 220);
  const wordCount = about.split(/\s+/).filter(Boolean).length;
  const hasHook = /^(\?|why|how|when|after|\d+|most|if\b|every\b)/i.test(first220.trim()) || /\d+%|\d+x|\d+\+/.test(first220);
  const hasCta = /\b(connect|message|reach|email|contact|dm|let's talk|book|hire)\b/i.test(about);
  const pronouns = (about.match(/\b(i|me|my|we|our)\b/gi) ?? []).length;
  const hasProblem = /\b(problem|challenge|gap|struggle|risk|bottleneck)\b/i.test(about);
  const hasApproach = /\b(approach|build|design|lead|use|through|by)\b/i.test(about);
  const hasResult = /\b(result|impact|improved|increased|reduced|delivered|saved|grew)\b/i.test(about);

  return {
    first_220_chars: first220,
    first_220_hook_strength: Math.min(100, 35 + (hasHook ? 30 : 0) + (/\d/.test(first220) ? 15 : 0) + (first220.length >= 120 ? 20 : 0)),
    word_count: wordCount,
    has_cta: hasCta,
    pronoun_balance: pronouns === 0 ? "No first-person voice detected; LinkedIn About can use I/my naturally." : pronouns > 20 ? "First-person voice is high; balance it with audience value." : "Good first-person balance for LinkedIn.",
    story_arc: hasProblem && hasApproach && hasResult ? "Problem -> Approach -> Result structure detected" : "Story arc needs clearer Problem -> Approach -> Result flow.",
    suggestions: [
      wordCount < 250 ? "About is short. Aim for 1500-2000 characters with a hook, credibility, proof, and CTA." : "",
      wordCount > 420 ? "About may be long. Keep the first 220 characters strong and break into short paragraphs." : "",
      !hasCta ? "Add a clear final CTA: connect, message, portfolio link, or role interest." : "",
      !hasHook ? "Strengthen the first 220 characters with a question, metric, or specific outcome." : "",
    ].filter(Boolean).slice(0, 4),
  };
}

function extractLabel(text: string, label: string) {
  const match = new RegExp(`${label}:\\s*(.+)`, "i").exec(text);
  return match?.[1]?.trim() ?? "";
}

function extractAbout(text: string) {
  const match = /About\/Summary:\s*([\s\S]*?)(?:\n\nExperience|Experience List:|Skills:|$)/i.exec(text);
  return match?.[1]?.trim() ?? "";
}

function extractSkills(text: string) {
  const match = /Skills:\s*(.+)/i.exec(text);
  return match?.[1]?.split(",").map((skill) => skill.trim()).filter(Boolean) ?? [];
}

function matchKnownNames(names: string[], lowerText: string) {
  return names.filter((name) => lowerText.includes(name.toLowerCase())).slice(0, 12);
}

function findLkPhone(text: string) {
  return /(?:\+94|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/.exec(text)?.[0] ?? "";
}

function inferIndustry(lower: string) {
  if (/\b(aht|fcr|csat|voice|bpo|contact center|queue)\b/.test(lower)) return "bpo";
  if (/\b(apparel|garment|aql|line balancing|merchandising|costing)\b/.test(lower)) return "apparel";
  if (/\b(hotel|tourism|front office|revpar|adr|f&b|ota)\b/.test(lower)) return "tourism";
  if (/\b(bank|banking|kyc|aml|casa|npl|treasury)\b/.test(lower)) return "banking";
  return "tech";
}

function analyzeHashtags(hashtags: string[], suggested: string[]) {
  const generic = hashtags.filter((tag) => /leadership|innovation|success|motivation/i.test(tag));
  return [
    hashtags.length === 0 ? `Add 3-5 consistent hashtags such as ${suggested.slice(0, 3).join(", ")}.` : "",
    hashtags.length > 8 ? "Use fewer hashtags. LinkedIn posts usually perform better with 3-5 focused tags." : "",
    generic.length ? `Replace generic hashtags with more specific tags: ${generic.join(", ")}.` : "",
  ].filter(Boolean);
}

function buildPostIdeas(role: string, industry: string, skills: string[]) {
  return [
    `Story post: A hard lesson I learned while working as a ${role || "professional"}.`,
    `Framework post: My 3-step approach to improving ${skills[0] || "team delivery"}.`,
    `Case study post: How a ${industry} workflow improved after one practical change.`,
    `Question post: What is one skill every ${role || "professional"} should learn in 2026?`,
    `Carousel outline: 8 slides on ${skills[1] || "career growth"} for Sri Lankan professionals.`,
  ];
}

function buildBooleanSearches(role: string, skills: string[], audienceMode: LinkedInAudienceMode) {
  const location = audienceMode === "local" ? '"Colombo" OR "Sri Lanka"' : '"Remote" OR "Global"';
  const core = skills.slice(0, 3).map((skill) => `"${skill}"`).join(" AND ");
  return [
    `${core} AND ${location}`,
    `"${role || "Professional"}" AND ${skills.slice(0, 2).map((skill) => `"${skill}"`).join(" AND ")}`,
  ].filter((item) => item.replace(/"/g, "").trim().length > 10);
}

function isCleanVanityUrl(vanityUrl: string) {
  return vanityUrl.length >= 3 && !/[0-9a-f]{8,}/i.test(vanityUrl) && !/\s/.test(vanityUrl);
}

function scoreLabel(score: number) {
  if (score >= 90) return "Recruiter-ready";
  if (score >= 75) return "Strong profile, minor polish";
  if (score >= 60) return "Visible but missing key signals";
  return "Major sections need work";
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .map((part) => (part.length <= 3 && part === part.toUpperCase() ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

function sameKeyword(left: string, right: string) {
  return left.toLowerCase().replace(/[^a-z0-9]/g, "") === right.toLowerCase().replace(/[^a-z0-9]/g, "");
}
