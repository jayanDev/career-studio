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

export async function verifyTalentProfileAction(
  locale: Locale,
  profileId: string,
  isVerified: boolean,
  verificationBadgeOrFormData: string | FormData = ""
) {
  await requireStaff(locale);
  
  let verificationBadge = "";
  if (typeof verificationBadgeOrFormData === "string") {
    verificationBadge = verificationBadgeOrFormData;
  } else if (verificationBadgeOrFormData instanceof FormData) {
    verificationBadge = (verificationBadgeOrFormData.get("badge") as string) || "";
  }

  const parsed = z.object({
    profileId: z.string().uuid(),
    isVerified: z.boolean(),
    verificationBadge: z.string(),
  }).parse({ profileId, isVerified, verificationBadge });

  await prisma.talentProfile.update({
    where: { id: parsed.profileId },
    data: {
      isVerified: parsed.isVerified,
      verificationBadge: parsed.verificationBadge,
    },
  });

  revalidatePath(`/${locale}/admin`);
}

export async function verifyRecruiterProfileAction(
  locale: Locale,
  recruiterProfileId: string,
  isVerified: boolean,
  accessLevelOrFormData: string | FormData = "verified"
) {
  await requireStaff(locale);

  let accessLevel = "verified";
  if (typeof accessLevelOrFormData === "string") {
    accessLevel = accessLevelOrFormData;
  } else if (accessLevelOrFormData instanceof FormData) {
    accessLevel = (accessLevelOrFormData.get("accessLevel") as string) || "verified";
  }

  const parsed = z.object({
    recruiterProfileId: z.string().uuid(),
    isVerified: z.boolean(),
    accessLevel: z.string(),
  }).parse({ recruiterProfileId, isVerified, accessLevel });

  await prisma.recruiterProfile.update({
    where: { id: parsed.recruiterProfileId },
    data: {
      isVerified: parsed.isVerified,
      accessLevel: parsed.accessLevel,
    },
  });

  revalidatePath(`/${locale}/admin`);
}


