import { z } from "zod";

const missingKeywordSchema = z.object({
  keyword: z.string(),
  priority: z.string(),
  placement: z.string(),
});

export const linkedInAuditResultSchema = z.object({
  score_breakdown: z.object({
    // Legacy dimensions (defaulted to allow back-compat)
    completeness: z.number().default(0),
    keywords: z.number().default(0),
    readability: z.number().default(0),
    impact: z.number().default(0),
    consistency: z.number().default(0),
    recruiter_findability: z.number().default(0),
    // 4 SSI Dimensions
    profile_strength: z.number().default(0),
    authority: z.number().default(0),
    findability: z.number().default(0),
    engagement_readiness: z.number().default(0),
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
  
  // Detailed audits with fully conforming defaults to satisfy Zod types
  headline_analysis: z.object({
    char_count: z.number().default(0),
    hook_strength_score: z.number().default(0),
    has_value_prop: z.boolean().default(false),
    has_outcome_metrics: z.boolean().default(false),
    format_type: z.string().default("Generic"),
    mobile_visible: z.boolean().default(true),
    suggestions: z.array(z.string()).default([]),
  }).default({
    char_count: 0,
    hook_strength_score: 0,
    has_value_prop: false,
    has_outcome_metrics: false,
    format_type: "Generic",
    mobile_visible: true,
    suggestions: [],
  }),
  
  about_analysis: z.object({
    first_220_chars: z.string().default(""),
    first_220_hook_strength: z.number().default(0),
    word_count: z.number().default(0),
    has_cta: z.boolean().default(false),
    pronoun_balance: z.string().default("Good"),
    story_arc: z.string().default("Narrative arc detected"),
    suggestions: z.array(z.string()).default([]),
  }).default({
    first_220_chars: "",
    first_220_hook_strength: 0,
    word_count: 0,
    has_cta: false,
    pronoun_balance: "Good",
    story_arc: "Narrative arc detected",
    suggestions: [],
  }),
  
  rec_endorsement_analysis: z.object({
    recs_received: z.number().default(0),
    recs_given: z.number().default(0),
    suggested_rec_ask: z.string().default(""),
    top_endorsed_match: z.boolean().default(true),
    endorsement_feedback: z.string().default(""),
  }).default({
    recs_received: 0,
    recs_given: 0,
    suggested_rec_ask: "",
    top_endorsed_match: true,
    endorsement_feedback: "",
  }),
  
  featured_audit: z.object({
    is_populated: z.boolean().default(false),
    suggestions: z.array(z.string()).default([]),
  }).default({
    is_populated: false,
    suggestions: [],
  }),
  
  open_to_work_audit: z.object({
    badge_status: z.string().default("None"),
    recommendations: z.string().default(""),
  }).default({
    badge_status: "None",
    recommendations: "",
  }),
  
  sri_lanka_moat: z.object({
    local_companies_matched: z.array(z.string()).default([]),
    local_universities_matched: z.array(z.string()).default([]),
    local_certs_matched: z.array(z.string()).default([]),
    has_nic_warning: z.boolean().default(false),
    lk_phone_normalized: z.string().default(""),
    local_hashtags: z.array(z.string()).default([]),
    bilingual_support: z.string().default(""),
    diaspora_leverage: z.string().default(""),
    compliance_mode_warning: z.string().default(""),
  }).default({
    local_companies_matched: [],
    local_universities_matched: [],
    local_certs_matched: [],
    has_nic_warning: false,
    lk_phone_normalized: "",
    local_hashtags: [],
    bilingual_support: "",
    diaspora_leverage: "",
    compliance_mode_warning: "",
  }),
});

export type LinkedInAuditResult = z.infer<typeof linkedInAuditResultSchema>;
