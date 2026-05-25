export interface BulletItem {
  id: string;
  role: string;
  actionVerb: string;
  metric: string;
  text: string;
}

// In a real application, this would be backed by a database or a large JSON file.
// Here we mock a subset of the 600 hand-written bullets.
export const RESUME_BULLET_LIBRARY: BulletItem[] = [
  {
    id: "se-1",
    role: "Software Engineer",
    actionVerb: "Architected",
    metric: "40% faster",
    text: "Architected a scalable microservices backend that reduced average API response times by 40% under peak load.",
  },
  {
    id: "se-2",
    role: "Software Engineer",
    actionVerb: "Spearheaded",
    metric: "$20k/yr",
    text: "Spearheaded the migration from EC2 to serverless Lambda functions, reducing infrastructure costs by $20k/yr.",
  },
  {
    id: "pm-1",
    role: "Product Manager",
    actionVerb: "Launched",
    metric: "15,000+ users",
    text: "Launched the core B2B SaaS platform to an initial cohort of 15,000+ users, achieving a 92% retention rate in Q1.",
  },
  {
    id: "mkt-1",
    role: "Marketing Specialist",
    actionVerb: "Driven",
    metric: "120% YoY",
    text: "Driven inbound lead generation campaigns that increased marketing-qualified leads (MQLs) by 120% YoY.",
  }
];

export function searchBullets(query: string, role?: string): BulletItem[] {
  const q = query.toLowerCase();
  return RESUME_BULLET_LIBRARY.filter(bullet => {
    const matchRole = role ? bullet.role.toLowerCase() === role.toLowerCase() : true;
    const matchQuery = q ? bullet.text.toLowerCase().includes(q) || bullet.actionVerb.toLowerCase().includes(q) : true;
    return matchRole && matchQuery;
  });
}
