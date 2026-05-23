import type { Prisma } from "@prisma/client";

import { defaultResumeContent, parseResumeContent, type ResumeContent } from "@/lib/resume-content";
import { findResumeTemplate } from "@/lib/resume-templates";
import { prisma } from "@/lib/prisma";

export type ResumeCreateDraft = {
  userId: string;
  title: string;
  templateKey: string;
};

export async function createResumeDraft(draft: ResumeCreateDraft) {
  const template = findResumeTemplate(draft.templateKey);
  const content = defaultResumeContent(template.defaultContent);

  return prisma.resume.create({
    data: {
      userId: draft.userId,
      title: draft.title,
      templateKey: draft.templateKey,
      content: {
        create: {
          data: content as Prisma.InputJsonValue,
          sectionOrder: content.sectionOrder as Prisma.InputJsonValue,
        },
      },
    },
    include: {
      content: true,
    },
  });
}

export async function saveResumeSnapshot(resumeId: string, content: ResumeContent, changeSummary: string) {
  const existingVersion = await prisma.resumeVersion.findFirst({
    where: { resumeId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true, createdAt: true },
  });

  const isAutosave = changeSummary.toLowerCase().includes("autosaved");
  const tenMinutesMs = 10 * 60 * 1000;
  if (isAutosave && existingVersion && Date.now() - existingVersion.createdAt.getTime() < tenMinutesMs) {
    return;
  }

  await prisma.resumeVersion.create({
    data: {
      resumeId,
      contentSnapshot: content as Prisma.InputJsonValue,
      versionNumber: (existingVersion?.versionNumber ?? 0) + 1,
      changeSummary,
      createdBy: "User",
      isCurrent: true,
    },
  });
}

export async function getResumeForUser(userId: string, resumeId: string) {
  const resume = await prisma.resume.findFirst({
    where: { id: resumeId, userId },
    include: { content: true },
  });

  if (!resume) {
    return null;
  }

  return {
    ...resume,
    parsedContent: parseResumeContent(resume.content?.data),
  };
}
