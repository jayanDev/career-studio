import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CareerGpsResource = {
  type: "COURSE" | "TOOL" | "RESOURCE" | "INTERVIEW";
  id: string;
  title: string;
  url: string;
};

function keywordFilters(fields: string[], keywords: string[]) {
  return keywords.flatMap((keyword) =>
    fields.map((field) => ({
      [field]: { contains: keyword, mode: "insensitive" },
    }))
  );
}

export async function getCandidateResources(keywords: string[], limit = 40): Promise<CareerGpsResource[]> {
  const cleanKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  const perBucket = Math.max(5, Math.floor(limit / 4));
  const courseWhere: Prisma.CourseWhereInput = cleanKeywords.length
    ? { OR: keywordFilters(["title", "summary", "industry", "subcategory"], cleanKeywords) as Prisma.CourseWhereInput[] }
    : {};
  const toolWhere: Prisma.ToolWhereInput = cleanKeywords.length
    ? { OR: keywordFilters(["name", "tagline", "tags", "industry"], cleanKeywords) as Prisma.ToolWhereInput[] }
    : {};
  const resourceWhere: Prisma.ResourceWhereInput = {
    isPublished: true,
    ...(cleanKeywords.length ? { OR: keywordFilters(["title", "description", "tags"], cleanKeywords) as Prisma.ResourceWhereInput[] } : {}),
  };
  const interviewWhere: Prisma.InterviewQuestionWhereInput = {
    isActive: true,
    ...(cleanKeywords.length ? { OR: keywordFilters(["questionText", "tags"], cleanKeywords) as Prisma.InterviewQuestionWhereInput[] } : {}),
  };
  const [courses, tools, resources, questions] = await Promise.all([
    prisma.course.findMany({ where: courseWhere, take: perBucket, orderBy: { providerVerified: "desc" } }),
    prisma.tool.findMany({ where: toolWhere, take: perBucket, orderBy: { verified: "desc" } }),
    prisma.resource.findMany({ where: resourceWhere, take: perBucket, orderBy: { updatedAt: "desc" } }),
    prisma.interviewQuestion.findMany({ where: interviewWhere, take: perBucket, orderBy: { timesPracticed: "desc" } }),
  ]);

  return [
    ...courses.map((course) => ({
      type: "COURSE" as const,
      id: String(course.id),
      title: course.title,
      url: course.officialUrl || course.detailsUrl || "/courses",
    })),
    ...tools.map((tool) => ({
      type: "TOOL" as const,
      id: String(tool.id),
      title: tool.name,
      url: tool.link || "/courses/tools",
    })),
    ...resources.map((resource) => ({
      type: "RESOURCE" as const,
      id: resource.id,
      title: resource.title,
      url: `/resources/${resource.slug}`,
    })),
    ...questions.map((question) => ({
      type: "INTERVIEW" as const,
      id: question.id,
      title: question.questionText.slice(0, 120),
      url: "/interview",
    })),
  ].slice(0, limit);
}
