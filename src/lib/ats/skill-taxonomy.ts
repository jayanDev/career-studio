/**
 * Skill taxonomy / synonym mapping (P3-22).
 *
 * Maps common variant spellings of a skill to a single canonical form so
 * keyword matching doesn't penalise users who write "JS" while the JD
 * asks for "JavaScript". Used by `matchJdAgainstResume` (indirectly via
 * `normaliseSkill`) and by `keyword-placement` so we don't suggest the
 * user re-add a skill they already have under a different name.
 *
 * Scope: deliberately small and pragmatic. Not a full ESCO / O*NET import
 * — that's a separate data-engineering project. This list covers the
 * highest-volume synonyms we see in SL tech / business CVs.
 */

const SYNONYMS: Array<[string, string[]]> = [
  ["JavaScript", ["JS", "ECMAScript", "ES6", "ES2015", "ES2020", "vanilla js"]],
  ["TypeScript", ["TS"]],
  ["Node.js", ["Node", "NodeJS"]],
  ["React", ["ReactJS", "React.js"]],
  ["Next.js", ["NextJS", "Next"]],
  ["Vue.js", ["Vue", "VueJS"]],
  ["Angular", ["AngularJS", "Angular 2+"]],
  ["Python", ["Py"]],
  ["C#", ["CSharp", "C-Sharp", ".NET C#"]],
  ["C++", ["CPP", "Cplusplus"]],
  ["Go", ["Golang"]],
  ["Kotlin", ["KT"]],
  ["Objective-C", ["ObjC", "Objective C"]],
  ["PostgreSQL", ["Postgres", "PSQL", "PG"]],
  ["MySQL", ["MariaDB"]],
  ["MongoDB", ["Mongo"]],
  ["Microsoft SQL Server", ["MSSQL", "SQL Server", "T-SQL"]],
  ["Amazon Web Services", ["AWS"]],
  ["Google Cloud Platform", ["GCP", "Google Cloud"]],
  ["Microsoft Azure", ["Azure"]],
  ["Kubernetes", ["K8s"]],
  ["Docker", ["Containers"]],
  ["Terraform", ["IaC", "HCL"]],
  ["Continuous Integration", ["CI"]],
  ["Continuous Delivery", ["CD"]],
  ["CI/CD", ["CICD", "CI / CD"]],
  ["Test-Driven Development", ["TDD"]],
  ["Behaviour-Driven Development", ["BDD"]],
  ["Object-Oriented Programming", ["OOP"]],
  ["Functional Programming", ["FP"]],
  ["Application Programming Interface", ["API"]],
  ["Representational State Transfer", ["REST", "RESTful"]],
  ["GraphQL", ["GQL"]],
  ["Search Engine Optimisation", ["SEO"]],
  ["Search Engine Marketing", ["SEM"]],
  ["User Interface", ["UI"]],
  ["User Experience", ["UX"]],
  ["Customer Relationship Management", ["CRM"]],
  ["Enterprise Resource Planning", ["ERP"]],
  ["Human Resources", ["HR"]],
  ["Key Performance Indicator", ["KPI", "KPIs"]],
  ["Return on Investment", ["ROI"]],
  ["Project Management Professional", ["PMP"]],
  ["Six Sigma", ["6 Sigma", "Lean Six Sigma"]],
  ["Microsoft Excel", ["Excel", "MS Excel"]],
  ["Microsoft Power BI", ["Power BI", "PowerBI"]],
  ["Tableau", ["Tableau Desktop"]],
  ["Adobe Photoshop", ["Photoshop", "PS"]],
  ["Adobe Illustrator", ["Illustrator", "AI", "Adobe AI"]],
  ["Figma", ["Figma Design"]],
  ["Know Your Customer", ["KYC"]],
  ["Anti-Money Laundering", ["AML"]],
  ["Average Handle Time", ["AHT"]],
  ["First Call Resolution", ["FCR"]],
  ["Customer Satisfaction", ["CSAT"]],
  ["Net Promoter Score", ["NPS"]],
  ["Service Level Agreement", ["SLA"]],
  ["Standard Minute Value", ["SMV"]],
  ["Bill of Materials", ["BOM"]],
  ["Acceptable Quality Limit", ["AQL"]],
];

// Build a normaliser lookup: lowercased variant -> canonical
const NORMALISE: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of SYNONYMS) {
    map.set(canonical.toLowerCase(), canonical);
    for (const alias of aliases) {
      map.set(alias.toLowerCase(), canonical);
    }
  }
  return map;
})();

/**
 * Normalise a single skill string to its canonical form. Returns the
 * input unchanged if no mapping exists.
 */
export function normaliseSkill(raw: string): string {
  const key = raw.trim().toLowerCase();
  return NORMALISE.get(key) ?? raw.trim();
}

/**
 * Returns true if `a` and `b` are the same skill under our taxonomy
 * (case-insensitive, accounting for known synonyms).
 */
export function isSameSkill(a: string, b: string): boolean {
  return normaliseSkill(a).toLowerCase() === normaliseSkill(b).toLowerCase();
}

/**
 * Given a list of skills, return a deduplicated list keyed off the
 * canonical form (preserving first-seen order). Useful for collapsing
 * "JS, JavaScript, ES6" to a single "JavaScript" entry.
 */
export function dedupeSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const canonical = normaliseSkill(s);
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

/**
 * Returns true if `resumeText` mentions a skill that's a synonym of
 * `keyword`. Used as a stricter contains-check when matching JD skills.
 */
export function resumeMentionsSkill(resumeTextLower: string, keyword: string): boolean {
  const canonical = normaliseSkill(keyword).toLowerCase();
  // Check canonical itself
  if (resumeTextLower.includes(canonical)) return true;
  // Check all aliases of the canonical
  for (const [c, aliases] of SYNONYMS) {
    if (c.toLowerCase() !== canonical) continue;
    for (const alias of aliases) {
      if (resumeTextLower.includes(alias.toLowerCase())) return true;
    }
    break;
  }
  return false;
}
