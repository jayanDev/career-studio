import { z } from "zod";

const missingKeywordSchema = z.object({
  keyword: z.string(),
  priority: z.string(),
  placement: z.string(),
});

export const linkedInAuditResultSchema = z.object({
  score_breakdown: z.object({
    completeness: z.number().default(0),
    keywords: z.number().default(0),
    readability: z.number().default(0),
    impact: z.number().default(0),
    consistency: z.number().default(0),
    recruiter_findability: z.number().default(0),
  }),
  missing_keywords: z.array(missingKeywordSchema).default([]),
  section_scores: z.record(z.string(), z.number()).default({}),
  checklist_items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      completed: z.boolean(),
      impact: z.string(),
    })
  ).default([]),
  summary_feedback: z.string().default(""),
});

export type LinkedInAuditResult = z.infer<typeof linkedInAuditResultSchema>;
