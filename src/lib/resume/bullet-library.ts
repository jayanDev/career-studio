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
  // Software Engineering
  { id: "se-1", role: "Software Engineer", actionVerb: "Architected", metric: "40% faster", text: "Architected a scalable microservices backend that reduced average API response times by 40% under peak load." },
  { id: "se-2", role: "Software Engineer", actionVerb: "Spearheaded", metric: "$20k/yr", text: "Spearheaded the migration from EC2 to serverless Lambda functions, reducing infrastructure costs by $20k/yr." },
  { id: "se-3", role: "Software Engineer", actionVerb: "Developed", metric: "99.99% uptime", text: "Developed high-throughput data ingestion pipelines using Apache Kafka, achieving 99.99% uptime during peak holiday seasons." },
  { id: "se-4", role: "Software Engineer", actionVerb: "Optimized", metric: "60% reduction", text: "Optimized legacy SQL queries, resulting in a 60% reduction in database load and faster dashboard rendering times." },
  
  // Product Management
  { id: "pm-1", role: "Product Manager", actionVerb: "Launched", metric: "15,000+ users", text: "Launched the core B2B SaaS platform to an initial cohort of 15,000+ users, achieving a 92% retention rate in Q1." },
  { id: "pm-2", role: "Product Manager", actionVerb: "Led", metric: "25% increase", text: "Led a cross-functional team of 12 engineers and designers to launch a mobile app feature, driving a 25% increase in daily active users." },
  { id: "pm-3", role: "Product Manager", actionVerb: "Prioritized", metric: "$1.2M ARR", text: "Prioritized the product roadmap based on user feedback and market analysis, unlocking $1.2M in new Annual Recurring Revenue (ARR)." },
  
  // Marketing
  { id: "mkt-1", role: "Marketing Specialist", actionVerb: "Driven", metric: "120% YoY", text: "Driven inbound lead generation campaigns that increased marketing-qualified leads (MQLs) by 120% YoY." },
  { id: "mkt-2", role: "Marketing Specialist", actionVerb: "Managed", metric: "$500k budget", text: "Managed a $500k annual digital marketing budget across Google Ads and LinkedIn, improving Return on Ad Spend (ROAS) by 35%." },
  { id: "mkt-3", role: "Marketing Specialist", actionVerb: "Orchestrated", metric: "50,000 attendees", text: "Orchestrated a virtual industry summit that attracted 50,000 attendees and generated 5,000+ qualified enterprise leads." },
  
  // Data Science
  { id: "ds-1", role: "Data Scientist", actionVerb: "Built", metric: "15% improvement", text: "Built and deployed a churn prediction XGBoost model that identified at-risk customers with 85% accuracy, leading to a 15% improvement in retention." },
  { id: "ds-2", role: "Data Scientist", actionVerb: "Automated", metric: "20 hours/week", text: "Automated daily reporting workflows using Python and Airflow, saving the analytics team 20 hours/week in manual data extraction." },
  
  // Sales
  { id: "sls-1", role: "Sales Executive", actionVerb: "Exceeded", metric: "140% of quota", text: "Exceeded annual sales targets by closing $2.5M in enterprise contracts, achieving 140% of the assigned quota in FY2025." },
  { id: "sls-2", role: "Sales Executive", actionVerb: "Negotiated", metric: "$500k contract", text: "Negotiated and closed a multi-year $500k contract with a Fortune 500 client after a 6-month competitive bidding process." },
];

import { prisma } from "@/lib/prisma";

export async function searchBullets(query: string, role?: string): Promise<BulletItem[]> {
  try {
    const q = query.toLowerCase();
    
    // Attempt to fetch from DB first
    const whereClause: any = {};
    if (role) {
      whereClause.role = { contains: role, mode: "insensitive" };
    }
    if (q) {
      whereClause.OR = [
        { text: { contains: q, mode: "insensitive" } },
        { actionVerb: { contains: q, mode: "insensitive" } }
      ];
    }
    
    const dbBullets = await prisma.resumeBullet.findMany({
      where: whereClause,
      take: 50
    });
    
    if (dbBullets && dbBullets.length > 0) {
      return dbBullets.map((b: any) => ({
        id: b.id,
        role: b.role,
        actionVerb: b.actionVerb,
        metric: b.metric,
        text: b.text
      }));
    }
  } catch {
    // Silently fallback to static if DB is not available
  }

  // Fallback to static library
  const q = query.toLowerCase();
  return RESUME_BULLET_LIBRARY.filter(bullet => {
    const matchRole = role ? bullet.role.toLowerCase() === role.toLowerCase() : true;
    const matchQuery = q ? bullet.text.toLowerCase().includes(q) || bullet.actionVerb.toLowerCase().includes(q) : true;
    return matchRole && matchQuery;
  });
}
