import { z } from "zod";

export const resumeSectionKeys = [
  "header", "summary", "experience", "education", "skills", 
  "projects", "certifications", "languages", "awards", "volunteering"
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
  sectionOrder: z.array(z.enum(resumeSectionKeys)).default(["header", "summary", "experience", "education", "skills"]),
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
    projects: [],
    certifications: [],
    languages: [],
    awards: [],
    volunteering: [],
    sectionOrder: ["header", "summary", "experience", "education", "skills", "projects", "certifications"],
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
    "Projects",
    ...content.projects.map((item) => `${item.name} ${item.description} ${item.technologies.join(", ")}`),
    "Certifications",
    ...content.certifications.map((item) => `${item.name} ${item.issuer} ${item.date}`),
  ];

  return lines.filter(Boolean).join("\n");
}

export function coverLetterContentToText(content: CoverLetterContent) {
  return [
    content.headerContact,
    content.recipientDetails,
    content.opener,
    ...content.bodyParagraphs,
    content.achievements.length ? "Key Achievements:" : "",
    ...content.achievements.map((achievement) => `- ${achievement}`),
    content.closing,
    content.signature,
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
    })
    .safeParse(value);

  return coverLetterContentSchema.parse({
    headerContact: legacy.success ? legacy.data.header_contact ?? "" : "",
    recipientDetails: legacy.success ? legacy.data.recipient_details ?? "" : "",
    opener: legacy.success ? legacy.data.opener ?? "" : "",
    bodyParagraphs: legacy.success ? legacy.data.body_paragraphs ?? [] : [],
    achievements: legacy.success ? legacy.data.achievements ?? [] : [],
    closing: legacy.success ? legacy.data.closing ?? "" : "",
    signature: legacy.success ? legacy.data.signature ?? "" : "",
  });
}
