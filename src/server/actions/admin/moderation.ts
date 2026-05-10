"use server";

import { FeedbackStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/server/utils/action-helpers";

const commentSchema = z.object({
  commentId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

const feedbackSchema = z.object({
  feedbackId: z.string().uuid(),
  status: z.enum([
    FeedbackStatus.new,
    FeedbackStatus.in_review,
    FeedbackStatus.planned,
    FeedbackStatus.completed,
    FeedbackStatus.wont_fix,
  ]),
});

const flagSchema = z.object({
  flagId: z.string().uuid(),
  status: z.enum(["reviewed", "dismissed"]),
});

export async function moderateBlogCommentAction(locale: Locale, commentId: string, decision: "approve" | "reject") {
  await requireStaff(locale);
  const parsed = commentSchema.parse({ commentId, decision });

  if (parsed.decision === "approve") {
    await prisma.blogComment.update({
      where: { id: parsed.commentId },
      data: { isApproved: true },
    });
  } else {
    await prisma.blogComment.delete({
      where: { id: parsed.commentId },
    });
  }

  revalidatePath(`/${locale}/admin`);
}

export async function updateFeedbackModerationAction(locale: Locale, feedbackId: string, status: FeedbackStatus) {
  await requireStaff(locale);
  const parsed = feedbackSchema.parse({ feedbackId, status });

  await prisma.feedback.update({
    where: { id: parsed.feedbackId },
    data: { status: parsed.status },
  });

  revalidatePath(`/${locale}/admin`);
}

export async function updateForumFlagAction(locale: Locale, flagId: string, status: "reviewed" | "dismissed") {
  await requireStaff(locale);
  const parsed = flagSchema.parse({ flagId, status });

  await prisma.forumFlag.update({
    where: { id: parsed.flagId },
    data: { status: parsed.status },
  });

  revalidatePath(`/${locale}/admin`);
}
