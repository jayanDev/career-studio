"use server";

import { FeedbackType } from "@prisma/client";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { prisma } from "@/lib/prisma";
import { formValue, requireUser } from "@/server/utils/action-helpers";

const feedbackSchema = z.object({
  type: z.enum([FeedbackType.bug, FeedbackType.feature, FeedbackType.improvement, FeedbackType.other]),
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  pageUrl: z.string().trim().max(500).default(""),
});

export async function createFeedbackAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = feedbackSchema.parse({
    type: formValue(formData, "type") || FeedbackType.other,
    title: formValue(formData, "title"),
    message: formValue(formData, "message"),
    pageUrl: formValue(formData, "pageUrl"),
  });

  await prisma.feedback.create({
    data: {
      userId: user.id,
      type: parsed.type,
      title: parsed.title,
      message: parsed.message,
      pageUrl: parsed.pageUrl,
    },
  });
}
