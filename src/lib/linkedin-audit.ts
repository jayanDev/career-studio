import { z } from "zod";

const missingKeywordSchema = z.object({
  keyword: z.string(),
  priority: z.string(),
  placement: z.string(),
});

export const linkedInJdKeywordsSchema = z.object({
  hard_skills: z.array(z.string()).default([]),
  soft_skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  seniority: z.string().default("Mid"),
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

  profile_media_audit: z.object({
    photo_present: z.boolean().default(false),
    photo_score: z.number().default(0),
    photo_feedback: z.array(z.string()).default([]),
    banner_present: z.boolean().default(false),
    banner_score: z.number().default(0),
    banner_feedback: z.array(z.string()).default([]),
    vanity_url_clean: z.boolean().default(false),
    public_visibility_detected: z.boolean().default(false),
  }).default({
    photo_present: false,
    photo_score: 0,
    photo_feedback: [],
    banner_present: false,
    banner_score: 0,
    banner_feedback: [],
    vanity_url_clean: false,
    public_visibility_detected: false,
  }),

  jd_keyword_analysis: z.object({
    extracted: linkedInJdKeywordsSchema.default({
      hard_skills: [],
      soft_skills: [],
      certifications: [],
      tools: [],
      seniority: "Mid",
    }),
    match_score: z.number().default(0),
    matched_keywords: z.array(z.string()).default([]),
    missing_hard_skills: z.array(z.string()).default([]),
    missing_soft_skills: z.array(z.string()).default([]),
    missing_tools: z.array(z.string()).default([]),
    missing_certifications: z.array(z.string()).default([]),
    placement_hints: z.array(missingKeywordSchema).default([]),
  }).default({
    extracted: {
      hard_skills: [],
      soft_skills: [],
      certifications: [],
      tools: [],
      seniority: "Mid",
    },
    match_score: 0,
    matched_keywords: [],
    missing_hard_skills: [],
    missing_soft_skills: [],
    missing_tools: [],
    missing_certifications: [],
    placement_hints: [],
  }),

  activity_analysis: z.object({
    posts_per_week: z.number().default(0),
    last_post_days_ago: z.number().default(999),
    cadence_label: z.string().default("No recent activity detected"),
    engagement_score: z.number().default(0),
    hashtag_feedback: z.array(z.string()).default([]),
    best_time_to_post: z.string().default("Mon-Wed 9-11am SLT or 7-9pm SLT"),
    post_ideas: z.array(z.string()).default([]),
    comment_templates: z.array(z.string()).default([]),
  }).default({
    posts_per_week: 0,
    last_post_days_ago: 999,
    cadence_label: "No recent activity detected",
    engagement_score: 0,
    hashtag_feedback: [],
    best_time_to_post: "Mon-Wed 9-11am SLT or 7-9pm SLT",
    post_ideas: [],
    comment_templates: [],
  }),

  skills_optimizer: z.object({
    suggested_skills: z.array(z.string()).default([]),
    top_endorsed_skills: z.array(z.string()).default([]),
    mismatched_top_skills: z.array(z.string()).default([]),
    boolean_search_examples: z.array(z.string()).default([]),
  }).default({
    suggested_skills: [],
    top_endorsed_skills: [],
    mismatched_top_skills: [],
    boolean_search_examples: [],
  }),

  benchmark: z.object({
    peer_label: z.string().default("Comparable professionals"),
    strengths: z.array(z.string()).default([]),
    gaps: z.array(z.string()).default([]),
    progress_next_steps: z.array(z.string()).default([]),
    reaudit_recommended_on: z.string().default(""),
  }).default({
    peer_label: "Comparable professionals",
    strengths: [],
    gaps: [],
    progress_next_steps: [],
    reaudit_recommended_on: "",
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
    audience_mode: z.enum(["local", "global"]).default("global"),
    recruiter_activity_window: z.string().default("Mon-Wed 9-11am SLT and 7-9pm SLT"),
    industry_keyword_pack: z.array(z.string()).default([]),
    alumni_leverage: z.string().default(""),
    holiday_posting_note: z.string().default("Avoid major SL holiday periods unless the post is culturally relevant."),
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
    audience_mode: "global",
    recruiter_activity_window: "Mon-Wed 9-11am SLT and 7-9pm SLT",
    industry_keyword_pack: [],
    alumni_leverage: "",
    holiday_posting_note: "Avoid major SL holiday periods unless the post is culturally relevant.",
  }),
});

export type LinkedInAuditResult = z.infer<typeof linkedInAuditResultSchema>;
