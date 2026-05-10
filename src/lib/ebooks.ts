import { slugifyCommunityTitle } from "@/lib/community";

export type EbookCatalogItem = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  chapters: {
    title: string;
    body: string;
  }[];
};

const ebookTitles = [
  "Advanced ChatGPT",
  "AI Marketing",
  "Content Marketing",
  "Dev Ops Engineering Road Map",
  "LinkedIn Marketing",
  "Marketing Strategy",
] as const;

const ebookSummaries: Record<(typeof ebookTitles)[number], string> = {
  "Advanced ChatGPT": "Prompt patterns for research, career writing, interview preparation, and daily productivity.",
  "AI Marketing": "A practical primer on using AI for campaign planning, audience research, and content workflows.",
  "Content Marketing": "A concise guide to planning, writing, distributing, and measuring useful career-building content.",
  "Dev Ops Engineering Road Map": "A staged roadmap for Linux, cloud, CI/CD, observability, and production readiness.",
  "LinkedIn Marketing": "Profile, content, and networking tactics for making professional opportunities easier to find.",
  "Marketing Strategy": "Market research, positioning, channels, and measurement for early-career marketers.",
};

export const ebookCatalog: EbookCatalogItem[] = ebookTitles.map((title) => ({
  slug: slugifyCommunityTitle(title),
  title,
  category: title.includes("Marketing") ? "Marketing" : title.includes("Dev Ops") ? "Technology" : "AI",
  summary: ebookSummaries[title],
  chapters: [
    {
      title: "Overview",
      body: `${title} is part of the Career Studio ebook library carried over from the Django static catalogue. Use it as a focused reading path and keep personal notes as you go.`,
    },
    {
      title: "How to use this guide",
      body: "Read one section at a time, extract examples that match your target role, and turn the best ideas into resume bullets, interview stories, or weekly learning tasks.",
    },
    {
      title: "Sri Lanka career angle",
      body: "Adapt the examples to local hiring realities: LKR budgets, hybrid teams, Colombo-centred hiring pipelines, and regional opportunities across Sri Lanka.",
    },
  ],
}));

export function findEbook(slug: string) {
  return ebookCatalog.find((ebook) => ebook.slug === slug);
}
