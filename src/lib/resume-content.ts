import { z } from "zod";

export const resumeSectionKeys = [
  "header", "summary", "experience", "education", "skills", 
  "projects", "certifications", "languages", "awards", "volunteering", "publications", "references"
] as const;

export type ResumeSectionKey = (typeof resumeSectionKeys)[number];

export const resumeContentSchema = z.object({
  mode: z.enum(["international", "local"]).default("international"),
  header: z.object({
    fullName: z.string().default(""),
    title: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    location: z.string().default(""),
    linkedin: z.string().default(""),
    website: z.string().default(""),
    nic: z.string().default(""),
    street: z.string().default(""),
    district: z.string().default(""),
    postalCode: z.string().default(""),
    photoUrl: z.string().default(""),
    expectedSalary: z.string().default(""),
    salaryPeriod: z.enum(["monthly", "annual"]).default("monthly"),
  }),
  summary: z.string().default(""),
  experience: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().default(""),
        company: z.string().default(""),
        location: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        id: z.string(),
        institution: z.string().default(""),
        degree: z.string().default(""),
        field: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
      })
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  skillRatings: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        rating: z.number().int().min(1).max(5).default(3),
        category: z.string().default("Core"),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        description: z.string().default(""),
        technologies: z.array(z.string()).default([]),
        url: z.string().default(""),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        issuer: z.string().default(""),
        date: z.string().default(""),
      })
    )
    .default([]),
  languages: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        proficiency: z.string().default(""),
      })
    )
    .default([]),
  awards: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        issuer: z.string().default(""),
        date: z.string().default(""),
      })
    )
    .default([]),
  volunteering: z
    .array(
      z.object({
        id: z.string(),
        role: z.string().default(""),
        organization: z.string().default(""),
        startDate: z.string().default(""),
        endDate: z.string().default(""),
      })
    )
    .default([]),
  publications: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().default(""),
        publisher: z.string().default(""),
        date: z.string().default(""),
        url: z.string().default(""),
      })
    )
    .default([]),
  references: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().default(""),
        title: z.string().default(""),
        organization: z.string().default(""),
        phone: z.string().default(""),
        email: z.string().default(""),
        relationship: z.string().default(""),
      })
    )
    .default([]),
    sectionOrder: z.array(z.enum(resumeSectionKeys)).default(["header", "summary", "experience", "education", "skills"]),
  settings: z.object({
    font: z.enum(["inter", "roboto", "merriweather", "noto-sinhala", "noto-tamil"]).default("inter"),
    accentColor: z.string().default("#0f766e"), // teal-700
    exportFormat: z.enum(["ats-friendly", "pixel-perfect"]).default("pixel-perfect"),
    hideReferences: z.boolean().default(false),
    showSkillRatings: z.boolean().default(false),
    includePhoto: z.boolean().default(false),
    displayLanguage: z.enum(["en", "si", "ta"]).default("en"),
    dateFormat: z.enum(["month-year", "numeric"]).default("month-year"),
    publicAccess: z.enum(["private", "public", "password"]).default("private"),
    publicPassword: z.string().default(""),
    resumeModeNote: z.string().default(""),
  }).default({
    font: "inter",
    accentColor: "#0f766e",
    exportFormat: "pixel-perfect",
    hideReferences: false,
    showSkillRatings: false,
    includePhoto: false,
    displayLanguage: "en",
    dateFormat: "month-year",
    publicAccess: "private",
    publicPassword: "",
    resumeModeNote: "",
  }),
});

export type ResumeContent = z.infer<typeof resumeContentSchema>;

export function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultResumeContent(seed?: Partial<ResumeContent>): ResumeContent {
  return resumeContentSchema.parse({
    mode: "international",
    header: {
      fullName: "",
      title: "",
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
    summary: "",
    experience: [
      {
        id: createId(),
        title: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        bullets: [""],
      },
    ],
    education: [
      {
        id: createId(),
        institution: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
      },
    ],
    skills: ["Microsoft Excel", "Communication", "Problem Solving"],
    skillRatings: [],
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    volunteering: [],
    publications: [],
    references: [],
    sectionOrder: ["header", "summary", "experience", "education", "skills", "projects", "certifications"],
    settings: {
      font: "inter",
      accentColor: "#0f766e",
      exportFormat: "pixel-perfect",
      hideReferences: false,
      showSkillRatings: false,
      includePhoto: false,
      displayLanguage: "en",
      dateFormat: "month-year",
      publicAccess: "private",
      publicPassword: "",
      resumeModeNote: "",
    },
    ...seed,
  });
}

export function parseResumeContent(value: unknown): ResumeContent {
  const parsed = resumeContentSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultResumeContent();
}

export function resumeContentToText(content: ResumeContent) {
  const lines = [
    content.header.fullName,
    content.header.title,
    content.header.email,
    content.header.phone,
    content.header.location,
    content.header.street,
    content.header.district,
    content.header.postalCode,
    content.header.nic,
    content.header.expectedSalary,
    content.summary,
    "Experience",
    ...content.experience.flatMap((item) => [
      `${item.title} ${item.company} ${item.location} ${item.startDate} ${item.endDate}`,
      ...item.bullets,
    ]),
    "Education",
    ...content.education.map((item) => `${item.degree} ${item.field} ${item.institution} ${item.startDate} ${item.endDate}`),
    "Skills",
    content.skills.join(", "),
    ...content.skillRatings.map((item) => `${item.name} ${item.category} ${item.rating}/5`),
    "Projects",
    ...content.projects.map((item) => `${item.name} ${item.description} ${item.technologies.join(", ")}`),
    "Certifications",
    ...content.certifications.map((item) => `${item.name} ${item.issuer} ${item.date}`),
    "Languages",
    ...content.languages.map((item) => `${item.name} ${item.proficiency}`),
    "Awards",
    ...content.awards.map((item) => `${item.name} ${item.issuer} ${item.date}`),
    "Volunteering",
    ...content.volunteering.map((item) => `${item.role} ${item.organization} ${item.startDate} ${item.endDate}`),
    "Publications",
    ...content.publications.map((item) => `${item.title} ${item.publisher} ${item.date} ${item.url}`),
    "References",
    ...content.references.map((item) => `${item.name} ${item.title} ${item.organization} ${item.phone} ${item.email}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export function coverLetterContentToText(content: CoverLetterContent) {
  return [
    content.subject ? `Subject: ${content.subject}` : "",
    content.headerContact,
    content.recipientDetails,
    content.opener,
    ...content.bodyParagraphs,
    content.achievements.length ? "Key Achievements:" : "",
    ...content.achievements.map((achievement) => `- ${achievement}`),
    content.salaryExpectation,
    content.closing,
    content.signature,
    content.followUpDrafts.length ? "Follow-up drafts:" : "",
    ...content.followUpDrafts.map((draft) => `${draft.subject}\n${draft.body}`),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const coverLetterContentSchema = z.object({
  headerContact: z.string().default(""),
  recipientDetails: z.string().default(""),
  opener: z.string().default(""),
  bodyParagraphs: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
  closing: z.string().default(""),
  signature: z.string().default(""),
  subject: z.string().default(""),
  language: z.enum(["en", "si", "ta", "bilingual_si", "bilingual_ta"]).default("en"),
  mode: z.enum(["local", "international"]).default("international"),
  templateKey: z.string().default("classic"),
  accentColor: z.string().default("#0f766e"),
  lengthTarget: z.enum(["short", "standard", "long"]).default("standard"),
  dateFormat: z.enum(["sl_long", "us_long", "terse"]).default("sl_long"),
  jobApplicationId: z.string().default(""),
  jdProfile: z.object({
    company_name: z.string().default(""),
    role_title: z.string().default(""),
    hiring_manager: z.string().default(""),
    team: z.string().default(""),
    must_have_skills: z.array(z.string()).default([]),
    nice_to_have_skills: z.array(z.string()).default([]),
    values: z.array(z.string()).default([]),
    tone_signal: z.string().default("formal"),
    seniority: z.string().default("Mid"),
  }).default({
    company_name: "",
    role_title: "",
    hiring_manager: "",
    team: "",
    must_have_skills: [],
    nice_to_have_skills: [],
    values: [],
    tone_signal: "formal",
    seniority: "Mid",
  }),
  qualityScore: z.number().default(0),
  qualityLabel: z.string().default("Not scored"),
  matchedKeywords: z.array(z.string()).default([]),
  missingKeywords: z.array(z.object({
    keyword: z.string(),
    placement: z.string(),
    priority: z.enum(["HIGH", "MEDIUM"]).default("MEDIUM"),
  })).default([]),
  grammarIssues: z.array(z.string()).default([]),
  companyResearch: z.array(z.string()).default([]),
  referral: z.object({
    enabled: z.boolean().default(false),
    referrerName: z.string().default(""),
    referrerContext: z.string().default(""),
  }).default({ enabled: false, referrerName: "", referrerContext: "" }),
  salaryExpectation: z.string().default(""),
  salary: z.object({
    enabled: z.boolean().default(false),
    minimum: z.string().default(""),
    maximum: z.string().default(""),
    currency: z.string().default("LKR"),
    period: z.enum(["monthly", "annual"]).default("monthly"),
  }).default({ enabled: false, minimum: "", maximum: "", currency: "LKR", period: "monthly" }),
  followUpDrafts: z.array(z.object({
    kind: z.string().default(""),
    subject: z.string().default(""),
    body: z.string().default(""),
  })).default([]),
  variants: z.array(z.object({
    label: z.string(),
    text: z.string(),
  })).default([]),
  emailReady: z.object({
    subject: z.string().default(""),
    body: z.string().default(""),
  }).default({ subject: "", body: "" }),
  linkedInDm: z.string().default(""),
  comboPack: z.object({
    tailoredResumeNotes: z.array(z.string()).default([]),
    interviewQuestions: z.array(z.string()).default([]),
    hiringManagerDm: z.string().default(""),
  }).default({ tailoredResumeNotes: [], interviewQuestions: [], hiringManagerDm: "" }),
  performance: z.object({
    sentDate: z.string().default(""),
    replyReceived: z.boolean().default(false),
    interviewReceived: z.boolean().default(false),
    offerReceived: z.boolean().default(false),
  }).default({ sentDate: "", replyReceived: false, interviewReceived: false, offerReceived: false }),
});

export type CoverLetterContent = z.infer<typeof coverLetterContentSchema>;

export function parseCoverLetterContent(value: unknown): CoverLetterContent {
  const camel = coverLetterContentSchema.safeParse(value);
  if (camel.success) {
    return camel.data;
  }

  const legacy = z
    .object({
      header_contact: z.string().optional(),
      recipient_details: z.string().optional(),
      opener: z.string().optional(),
      body_paragraphs: z.array(z.string()).optional(),
      achievements: z.array(z.string()).optional(),
      closing: z.string().optional(),
      signature: z.string().optional(),
      subject: z.string().optional(),
    })
    .safeParse(value);

  return coverLetterContentSchema.parse({
    subject: legacy.success ? legacy.data.subject ?? "" : "",
    headerContact: legacy.success ? legacy.data.header_contact ?? "" : "",
    recipientDetails: legacy.success ? legacy.data.recipient_details ?? "" : "",
    opener: legacy.success ? legacy.data.opener ?? "" : "",
    bodyParagraphs: legacy.success ? legacy.data.body_paragraphs ?? [] : [],
    achievements: legacy.success ? legacy.data.achievements ?? [] : [],
    closing: legacy.success ? legacy.data.closing ?? "" : "",
    signature: legacy.success ? legacy.data.signature ?? "" : "",
  });
}
