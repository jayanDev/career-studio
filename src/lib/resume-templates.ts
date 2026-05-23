import type { PlanTier } from "@prisma/client";

import type { ResumeContent } from "@/lib/resume-content";

export type ResumeRoleTemplate = {
  roleName: string;
  slug: string;
  description: string;
  category: PlanTier;
  templateKey: string;
  defaultContent: Partial<ResumeContent>;
};

const roles = [
  ["Software Engineer", "software-engineer", "Builds reliable web, mobile, and cloud products."],
  ["Data Analyst", "data-analyst", "Turns raw data into practical business decisions."],
  ["Project Manager", "project-manager", "Plans delivery, manages risk, and aligns teams."],
  ["Marketing Manager", "marketing-manager", "Drives campaigns, growth channels, and brand performance."],
  ["Accountant", "accountant", "Handles reporting, audit support, and financial controls."],
  ["HR Executive", "hr-executive", "Supports hiring, onboarding, payroll, and employee relations."],
  ["Business Analyst", "business-analyst", "Bridges stakeholder needs and delivery requirements."],
  ["Customer Support Lead", "customer-support-lead", "Improves service quality, escalations, and customer outcomes."],
  ["Sales Executive", "sales-executive", "Builds pipeline, handles accounts, and closes revenue."],
  ["Graphic Designer", "graphic-designer", "Creates brand, campaign, and portfolio-led visual work."],
  ["UI UX Designer", "ui-ux-designer", "Designs user flows, prototypes, and usable product interfaces."],
  ["Quality Assurance Engineer", "qa-engineer", "Tests products, automates checks, and improves release quality."],
  ["DevOps Engineer", "devops-engineer", "Runs CI/CD, infrastructure, monitoring, and cloud reliability."],
  ["Operations Executive", "operations-executive", "Coordinates process, vendors, reporting, and daily delivery."],
  ["Teacher", "teacher", "Plans lessons, assesses learners, and improves classroom outcomes."],
  ["Nurse", "nurse", "Delivers patient care, documentation, and clinical coordination."],
  ["Civil Engineer", "civil-engineer", "Manages construction, site quality, and engineering documentation."],
  ["Finance Analyst", "finance-analyst", "Models forecasts, budgets, and performance insights."],
  ["Content Writer", "content-writer", "Writes SEO, brand, product, and educational content."],
  ["Hotel Operations Associate", "hotel-operations-associate", "Supports guest experience, reservations, and service delivery."],
] as const;

const tiers: PlanTier[] = ["basic", "pro", "premium"];

export const resumeRoleTemplates: ResumeRoleTemplate[] = roles.flatMap(([roleName, slug, description]) =>
  tiers.map((category) => ({
    roleName,
    slug: `${slug}-${category}`,
    description,
    category,
    templateKey: `${slug}-${category}`,
    defaultContent: {
      header: {
        fullName: "",
        title: roleName,
        email: "",
        phone: "",
        location: "Colombo, Sri Lanka",
        linkedin: "",
        website: "",
        nic: "",
        street: "",
        district: "",
        postalCode: "",
        photoUrl: "",
        expectedSalary: "",
        salaryPeriod: "monthly",
      },
      summary: `Results-focused ${roleName.toLowerCase()} with experience supporting teams, improving workflows, and delivering measurable outcomes in Sri Lankan and remote environments.`,
      skills: category === "basic" ? ["Communication", "Problem Solving", "Microsoft Excel"] : ["Communication", "Problem Solving", "Microsoft Excel", "Stakeholder Management", "Reporting"],
    },
  }))
);

export const featuredResumeTemplates = resumeRoleTemplates.filter((template) =>
  ["software-engineer-basic", "data-analyst-basic", "marketing-manager-pro", "accountant-basic", "project-manager-premium", "ui-ux-designer-pro"].includes(template.slug)
);

export function findResumeTemplate(templateKey: string) {
  return resumeRoleTemplates.find((template) => template.templateKey === templateKey) ?? resumeRoleTemplates[0];
}
