import { slCertifications, slCompanies, slUniversities } from "@/lib/sl-data";
import type { CareerGpsPlanResult } from "@/lib/career-gps";

export type CareerGpsInputProfile = {
  story: string;
  primaryRole: string;
  secondaryRole: string;
  experienceLevel: string;
  constraints: string;
  learningStyle: string;
  ambitionMode: "local" | "global" | "hybrid";
  sectorPreference: "private" | "public" | "either";
  alStream: string;
  familyExpectation: number;
  diasporaMode: boolean;
  languageMode: "en" | "si" | "ta";
  hollandCode: string;
};

const skillHints = [
  "Python", "JavaScript", "React", "SQL", "Excel", "Power BI", "Project Management", "Communication",
  "Leadership", "Customer Service", "Data Analysis", "Accounting", "KYC", "AML", "Digital Marketing",
  "Figma", "Cloud", "Django", "Next.js", "Sales", "Operations", "AHT", "CSAT", "AQL", "Merchandising",
];

const careerDomains: Record<string, string[]> = {
  Tech: ["Software Engineer", "Data Analyst", "Solutions Architect", "Product Manager", "QA Engineer"],
  Business: ["Business Analyst", "Operations Manager", "Project Manager", "Management Consultant"],
  Finance: ["Banking Associate", "Financial Analyst", "Audit Associate", "Risk Analyst"],
  Creative: ["UX Designer", "Content Strategist", "Brand Manager", "Developer Advocate"],
  Service: ["Customer Success Manager", "BPO Team Lead", "Hotel Operations Manager", "Training Specialist"],
};

const slIndustryLadders: Record<string, string> = {
  bpo: "Agent -> Team Lead -> Process Trainer -> Ops Manager -> Director",
  apparel: "Production Executive -> IE -> Production Manager -> Factory Manager -> COO",
  tourism: "Front Office -> Guest Relations -> Duty Manager -> Hotel Manager -> GM",
  banking: "Banking Associate -> Branch Officer -> Branch Manager -> Regional Manager",
  tea: "Estate Trainee -> Field Officer -> Estate Manager -> Regional VP",
  tech: "Intern -> Associate Engineer -> Engineer -> Senior -> Lead -> Architect/Manager",
};

export function buildCareerGpsEnhancements(input: CareerGpsInputProfile, plan: CareerGpsPlanResult): CareerGpsPlanResult {
  const currentSkills = extractSkills(input.story);
  const targetSkills = Array.from(new Set([
    ...plan.skill_gaps.must_learn.map((gap) => gap.skill),
    ...plan.skill_gaps.optional.map((gap) => gap.skill),
    ...skillsForRole(input.primaryRole),
  ])).slice(0, 16);
  const transferable = currentSkills.filter((skill) => targetSkills.some((target) => sameSkill(skill, target)));
  const gaps = targetSkills.filter((skill) => !transferable.some((known) => sameSkill(known, skill))).slice(0, 10);
  const overlapPct = targetSkills.length ? Math.round((transferable.length / targetSkills.length) * 100) : 45;
  const careerRoles = Array.from(new Set([
    input.primaryRole,
    input.secondaryRole,
    ...plan.career_paths.map((path) => path.role),
    ...suggestAdjacentCareers(input, currentSkills),
  ].filter(Boolean))).slice(0, 14);
  const constellation = careerRoles.map((role, index) => {
    const match = Math.max(35, Math.min(96, role === input.primaryRole ? 88 : 82 - index * 3 + overlapPct / 8));
    const difficulty = transitionDifficulty({ overlapPct, role, input });
    return {
      id: role.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      role,
      domain: domainForRole(role),
      match,
      x: Math.round(50 + Math.cos(index * 0.9) * (22 + (index % 3) * 8)),
      y: Math.round(50 + Math.sin(index * 0.9) * (20 + (index % 4) * 6)),
      summary: `${difficulty.label} transition with ${match}% profile match.`,
      salary_lkr: salaryBand(role),
      difficulty: difficulty.score,
      difficulty_label: difficulty.label,
      nearest_neighbours: nearest(role).slice(0, 3),
    };
  });
  const topRoles = careerRoles.slice(0, 3);
  const pathways = [
    buildPathway("aligned", topRoles[0] || input.primaryRole, input, 9, "Closest to your current trajectory"),
    buildPathway("stretch", topRoles[1] || "Business Analyst", input, 18, "Adjacent move requiring focused upskilling"),
    buildPathway("pivot", topRoles[2] || "Product Manager", input, 36, "Larger change with a longer proof-building period"),
  ];
  const identity = buildIdentityStatement(input, currentSkills, pathways.map((path) => path.role));
  const strengthScore = Math.min(96, Math.max(54, 60 + Math.round(input.story.length / 220) + Math.min(14, currentSkills.length * 2) + (input.primaryRole ? 8 : 0)));

  return {
    ...plan,
    identity_statement: plan.identity_statement || identity,
    plan_strength: {
      score: plan.plan_strength.score || strengthScore,
      label: planStrengthLabel(strengthScore),
      reasons: [
        currentSkills.length ? `Detected transferable skills: ${currentSkills.slice(0, 5).join(", ")}` : "Add more detail about past work to improve match quality.",
        gaps.length ? `Main learning gaps: ${gaps.slice(0, 4).join(", ")}` : "Skill overlap is strong for the target role.",
      ],
    },
    identity_profile: {
      skills: currentSkills,
      interests: inferInterests(input.story),
      values: inferValues(input.story),
      motivations: inferMotivations(input.story),
      hidden_strengths: inferHiddenStrengths(input.story),
      holland_code: input.hollandCode || inferHollandCode(input.story),
      family_expectation: input.familyExpectation,
      ambition_mode: input.ambitionMode,
    },
    constellation,
    pathways,
    skill_overlap: {
      current_skills: currentSkills,
      target_skills: targetSkills,
      transferable,
      gaps,
      drop_or_deprioritize: inferDropSkills(currentSkills, targetSkills),
      overlap_pct: overlapPct,
    },
    sl_context: {
      al_stream_pathways: alPathways(input.alStream),
      industry_ladders: industryLaddersFor(`${input.story} ${input.primaryRole}`),
      certifications: slCertifications.filter((cert) => `${input.story} ${input.primaryRole}`.toLowerCase().includes(cert.toLowerCase().split(" ")[0])).slice(0, 6),
      universities: slUniversities.slice(0, 8),
      scholarships: ["Mahapola", "Chevening", "Fulbright", "DAAD", "Chinese Government Scholarships"],
      diaspora_bridge: input.diasporaMode ? `Map your overseas experience to SL employers such as ${slCompanies.slice(0, 5).join(", ")} and benchmark salary after cost-of-living adjustment.` : "",
      cost_of_living_note: input.ambitionMode === "local" ? "Compare Colombo opportunities with Kandy, Galle, and Jaffna using effective income, not salary alone." : "Global ambition mode should benchmark remote-friendly roles in USD/EUR as well as LKR.",
      cultural_calendar_notes: ["Use Avurudu/Vesak weeks for reflection or lighter review tasks.", "Avoid heavy application pushes during major holiday weeks."],
    },
    people_like_you: [
      { path: pathways[0].role, percent: 34, note: "Closest-profile users often start here because the first proof project is achievable." },
      { path: pathways[1].role, percent: 21, note: "Common adjacent move after one focused certification or portfolio project." },
      { path: pathways[2].role, percent: 12, note: "Lower-volume but viable with sustained proof-building." },
    ],
    saved_careers: topRoles,
    checkins: Array.from({ length: Math.min(12, plan.roadmap.weeks) }).map((_, index) => ({
      week: index + 1,
      prompt: `How did week ${index + 1} go? Mark completed, blocked, or skipped tasks and choose next week's priority.`,
      status: "pending" as const,
    })),
    share: {
      public_token: "",
      masked_pii: true,
      mentor_notes: ["Ask a mentor whether the chosen pathway is realistic for your current constraints."],
    },
  };
}

export function planStrengthLabel(score: number) {
  if (score >= 90) return "Roadmap is concrete and actionable";
  if (score >= 75) return "Strong direction, some week-level detail still missing";
  if (score >= 60) return "Direction set, week-level tasks need refinement";
  return "Try adding more detail about your background";
}

function extractSkills(text: string) {
  const lower = text.toLowerCase();
  return skillHints.filter((skill) => lower.includes(skill.toLowerCase())).slice(0, 12);
}

function skillsForRole(role: string) {
  const lower = role.toLowerCase();
  if (/software|engineer|developer|architect/.test(lower)) return ["JavaScript", "React", "SQL", "Cloud", "System Design", "Git"];
  if (/data|analyst/.test(lower)) return ["SQL", "Excel", "Power BI", "Data Analysis", "Statistics", "Communication"];
  if (/product|project|manager/.test(lower)) return ["Stakeholder Management", "Roadmapping", "Communication", "Analytics", "Leadership"];
  if (/bank|finance|audit|risk/.test(lower)) return ["Excel", "KYC", "AML", "Accounting", "Risk Controls", "Communication"];
  if (/bpo|customer|success/.test(lower)) return ["Customer Service", "CSAT", "AHT", "Communication", "Operations"];
  return ["Communication", "Problem Solving", "Portfolio evidence", "Interview storytelling"];
}

function suggestAdjacentCareers(input: CareerGpsInputProfile, skills: string[]) {
  const domains = Object.entries(careerDomains);
  const candidates = domains.flatMap(([, roles]) => roles);
  const boosted = candidates.sort((a, b) => scoreRole(b, input, skills) - scoreRole(a, input, skills));
  return boosted;
}

function scoreRole(role: string, input: CareerGpsInputProfile, skills: string[]) {
  const text = `${input.story} ${input.primaryRole} ${skills.join(" ")}`.toLowerCase();
  let score = 0;
  for (const skill of skillsForRole(role)) if (text.includes(skill.toLowerCase())) score += 10;
  if (input.hollandCode && role.toLowerCase().includes("analyst")) score += input.hollandCode.includes("I") ? 8 : 0;
  if (input.familyExpectation > 7 && /engineer|bank|doctor|account/.test(role.toLowerCase())) score += 8;
  return score;
}

function transitionDifficulty(input: { overlapPct: number; role: string; input: CareerGpsInputProfile }) {
  let score = input.overlapPct + 25;
  if (input.input.experienceLevel.toLowerCase().includes("senior")) score += 6;
  if (input.input.constraints.toLowerCase().includes("no relocate")) score -= 5;
  if (/doctor|lawyer|architect/.test(input.role.toLowerCase())) score -= 18;
  score = Math.max(25, Math.min(95, score));
  return { score, label: score >= 80 ? "Easy" : score >= 60 ? "Moderate" : score >= 40 ? "Stretch" : "Major pivot" };
}

function buildPathway(type: "aligned" | "stretch" | "pivot", role: string, input: CareerGpsInputProfile, months: number, risk: string) {
  return {
    type,
    role,
    summary: `${risk}: build proof for ${role} through learning, portfolio, networking, and focused applications.`,
    risk,
    time_to_transition_months: months,
    salary_curve_lkr: [1, 3, 5, 10].map((year) => ({ year, p25: salaryBase(role) + year * 25000, p75: salaryBase(role) + year * 55000 })),
    public_sector_fit: input.sectorPreference === "public" || input.sectorPreference === "either" ? "Possible via exams, cadetships, public projects, or state institutions where applicable." : "Lower priority based on your preference.",
    private_sector_fit: input.sectorPreference === "private" || input.sectorPreference === "either" ? "Strong route through portfolio proof, referrals, and targeted applications." : "Available, but your current preference leans public sector.",
  };
}

function buildIdentityStatement(input: CareerGpsInputProfile, skills: string[], roles: string[]) {
  const strengths = inferHiddenStrengths(input.story).slice(0, 2).join(" and ") || "learns quickly and connects ideas";
  const value = inferValues(input.story)[0] || "practical progress";
  return `You are someone who ${strengths}, with visible signals in ${skills.slice(0, 3).join(", ") || "your past experience"}. You seem energised by ${value}. People with a similar profile often explore ${roles.slice(0, 4).join(", ")}.`;
}

function domainForRole(role: string) {
  return Object.entries(careerDomains).find(([, roles]) => roles.some((item) => item.toLowerCase() === role.toLowerCase()))?.[0] ?? "General";
}

function nearest(role: string) {
  const domain = domainForRole(role);
  return careerDomains[domain]?.filter((item) => item !== role) ?? [];
}

function salaryBase(role: string) {
  const lower = role.toLowerCase();
  if (/software|data|product/.test(lower)) return 220000;
  if (/finance|bank|risk/.test(lower)) return 180000;
  if (/manager|lead/.test(lower)) return 260000;
  if (/bpo|customer/.test(lower)) return 120000;
  return 150000;
}

function salaryBand(role: string) {
  const base = salaryBase(role);
  return `Rs ${Math.round(base / 1000)}k-${Math.round((base * 1.8) / 1000)}k/month`;
}

function inferInterests(text: string) {
  return pickByWords(text, [
    ["building products", /build|create|ship|develop/i],
    ["helping people", /help|mentor|teach|support/i],
    ["analysis", /data|research|analyse|analyze/i],
    ["business impact", /business|revenue|operations|strategy/i],
  ]);
}

function inferValues(text: string) {
  return pickByWords(text, [
    ["stability", /stable|security|government|family/i],
    ["growth", /growth|learn|advance|promotion/i],
    ["autonomy", /freedom|remote|independent|flexible/i],
    ["impact", /impact|community|mission|public/i],
  ]);
}

function inferMotivations(text: string) {
  return pickByWords(text, [
    ["earning potential", /salary|income|money|financial/i],
    ["recognition", /recognition|title|lead/i],
    ["mastery", /expert|deep|technical|craft/i],
    ["service", /serve|help|support|care/i],
  ]);
}

function inferHiddenStrengths(text: string) {
  return pickByWords(text, [
    ["turns ambiguity into structure", /chaos|process|organize|coordinate/i],
    ["learns technical ideas quickly", /code|technical|software|data/i],
    ["communicates across teams", /stakeholder|client|customer|team/i],
    ["stays resilient under pressure", /pressure|deadline|crisis|challenge/i],
  ]);
}

function inferDropSkills(current: string[], target: string[]) {
  return current.filter((skill) => !target.some((item) => sameSkill(item, skill))).slice(0, 5);
}

function inferHollandCode(text: string) {
  const lower = text.toLowerCase();
  const code = [
    /build|repair|hands-on|field/.test(lower) ? "R" : "",
    /data|research|analyse|science/.test(lower) ? "I" : "",
    /design|write|creative|brand/.test(lower) ? "A" : "",
    /teach|mentor|support|care/.test(lower) ? "S" : "",
    /sell|lead|business|manage/.test(lower) ? "E" : "",
    /organize|process|finance|admin/.test(lower) ? "C" : "",
  ].filter(Boolean).join("");
  return (code || "IAS").slice(0, 3);
}

function alPathways(stream: string) {
  const key = stream.toLowerCase();
  if (key.includes("physical")) return ["Physical Science -> Engineering/CS -> Software, Engineering, Data"];
  if (key.includes("bio")) return ["Bio Science -> Medicine/Agriculture/Biology -> Health, Research, Public Health"];
  if (key.includes("commerce")) return ["Commerce -> BCom/BBA/CA/CIMA -> Banking, Audit, Finance"];
  if (key.includes("arts")) return ["Arts -> BA/LLB -> Law, Government, Education, NGO"];
  if (key.includes("vocational")) return ["Vocational/HND -> Hospitality, Apparel, Automotive, Technical trades"];
  return ["Choose A/L, degree, professional cert, or vocational route based on the target role."];
}

function industryLaddersFor(text: string) {
  const lower = text.toLowerCase();
  return Object.entries(slIndustryLadders).filter(([key]) => lower.includes(key)).map(([, ladder]) => ladder).slice(0, 4);
}

function pickByWords(text: string, pairs: Array<[string, RegExp]>) {
  const picked = pairs.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
  return picked.length ? picked : [pairs[0][0]];
}

function sameSkill(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase() || left.toLowerCase().includes(right.toLowerCase()) || right.toLowerCase().includes(left.toLowerCase());
}
