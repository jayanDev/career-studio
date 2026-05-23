import { CareerTaskType } from "@prisma/client";
import { z } from "zod";

const resourceRefSchema = z.object({
  type: z.string(),
  id: z.string().optional().default(""),
  title: z.string(),
});

export const careerGpsPlanResultSchema = z.object({
  identity_statement: z.string().default(""),
  plan_strength: z.object({
    score: z.number().int().min(0).max(100).default(70),
    label: z.string().default("Strong direction, some week-level detail still missing"),
    reasons: z.array(z.string()).default([]),
  }).default({ score: 70, label: "Strong direction, some week-level detail still missing", reasons: [] }),
  identity_profile: z.object({
    skills: z.array(z.string()).default([]),
    interests: z.array(z.string()).default([]),
    values: z.array(z.string()).default([]),
    motivations: z.array(z.string()).default([]),
    hidden_strengths: z.array(z.string()).default([]),
    holland_code: z.string().default(""),
    family_expectation: z.number().int().min(0).max(10).default(5),
    ambition_mode: z.enum(["local", "global", "hybrid"]).default("local"),
  }).default({ skills: [], interests: [], values: [], motivations: [], hidden_strengths: [], holland_code: "", family_expectation: 5, ambition_mode: "local" }),
  constellation: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      domain: z.string().default("General"),
      match: z.number().int().min(0).max(100),
      x: z.number().int().min(0).max(100).default(50),
      y: z.number().int().min(0).max(100).default(50),
      summary: z.string().default(""),
      salary_lkr: z.string().default(""),
      difficulty: z.number().int().min(0).max(100).default(60),
      difficulty_label: z.string().default("Moderate"),
      nearest_neighbours: z.array(z.string()).default([]),
    })
  ).default([]),
  pathways: z.array(
    z.object({
      type: z.enum(["aligned", "stretch", "pivot"]),
      role: z.string(),
      summary: z.string(),
      risk: z.string().default(""),
      time_to_transition_months: z.number().int().min(1).max(120).default(12),
      salary_curve_lkr: z.array(z.object({ year: z.number(), p25: z.number(), p75: z.number() })).default([]),
      public_sector_fit: z.string().default(""),
      private_sector_fit: z.string().default(""),
    })
  ).default([]),
  skill_overlap: z.object({
    current_skills: z.array(z.string()).default([]),
    target_skills: z.array(z.string()).default([]),
    transferable: z.array(z.string()).default([]),
    gaps: z.array(z.string()).default([]),
    drop_or_deprioritize: z.array(z.string()).default([]),
    overlap_pct: z.number().int().min(0).max(100).default(0),
  }).default({ current_skills: [], target_skills: [], transferable: [], gaps: [], drop_or_deprioritize: [], overlap_pct: 0 }),
  sl_context: z.object({
    al_stream_pathways: z.array(z.string()).default([]),
    industry_ladders: z.array(z.string()).default([]),
    certifications: z.array(z.string()).default([]),
    universities: z.array(z.string()).default([]),
    scholarships: z.array(z.string()).default([]),
    diaspora_bridge: z.string().default(""),
    cost_of_living_note: z.string().default(""),
    cultural_calendar_notes: z.array(z.string()).default([]),
  }).default({ al_stream_pathways: [], industry_ladders: [], certifications: [], universities: [], scholarships: [], diaspora_bridge: "", cost_of_living_note: "", cultural_calendar_notes: [] }),
  people_like_you: z.array(z.object({
    path: z.string(),
    percent: z.number().int().min(0).max(100),
    note: z.string(),
  })).default([]),
  saved_careers: z.array(z.string()).default([]),
  checkins: z.array(z.object({
    week: z.number().int().min(1).max(52),
    prompt: z.string(),
    status: z.enum(["pending", "done", "blocked", "skipped"]).default("pending"),
  })).default([]),
  share: z.object({
    public_token: z.string().default(""),
    masked_pii: z.boolean().default(true),
    mentor_notes: z.array(z.string()).default([]),
  }).default({ public_token: "", masked_pii: true, mentor_notes: [] }),
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
