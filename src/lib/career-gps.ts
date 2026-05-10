import { CareerTaskType } from "@prisma/client";
import { z } from "zod";

const resourceRefSchema = z.object({
  type: z.string(),
  id: z.string().optional().default(""),
  title: z.string(),
});

export const careerGpsPlanResultSchema = z.object({
  career_paths: z.array(
    z.object({
      role: z.string(),
      match: z.number().int().min(0).max(100),
      why: z.array(z.string()).default([]),
    })
  ),
  skill_gaps: z.object({
    must_learn: z.array(z.object({ skill: z.string(), reason: z.string() })).default([]),
    optional: z.array(z.object({ skill: z.string(), reason: z.string() })).default([]),
  }),
  roadmap: z.object({
    weeks: z.number().int().min(1).max(52),
    milestones: z.array(
      z.object({
        week_start: z.number().int().min(1),
        week_end: z.number().int().min(1),
        title: z.string(),
        description: z.string().default(""),
        tasks: z.array(
          z.object({
            week: z.number().int().min(1),
            type: z.nativeEnum(CareerTaskType),
            title: z.string(),
            effort_minutes: z.number().int().min(15).max(1440).default(60),
            outcome: z.string().default(""),
            resource_refs: z.array(resourceRefSchema).default([]),
          })
        ),
      })
    ),
  }),
});

export type CareerGpsPlanResult = z.infer<typeof careerGpsPlanResultSchema>;
