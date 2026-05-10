"use server";

import { redirect } from "next/navigation";
import { JobApplicationStatus, Priority } from "@prisma/client";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { jobPriorities, jobStatuses } from "@/lib/job-tracker";
import { prisma } from "@/lib/prisma";

const createApplicationSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().min(1).max(200),
  jobUrl: z.string().trim().url().optional().or(z.literal("")).default(""),
  location: z.string().trim().max(200).default(""),
  salaryRange: z.string().trim().max(100).default(""),
  status: z.enum(jobStatuses).default(JobApplicationStatus.bookmarked),
  priority: z.enum(jobPriorities).default(Priority.medium),
  appliedDate: z.string().trim().optional().default(""),
  followUpDate: z.string().trim().optional().default(""),
  recruiterName: z.string().trim().max(200).default(""),
  recruiterEmail: z.string().trim().email().optional().or(z.literal("")).default(""),
  recruiterPhone: z.string().trim().max(50).default(""),
  notes: z.string().trim().max(5000).default(""),
  tags: z.string().trim().max(200).default(""),
});

const statusUpdateSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(jobStatuses),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function requireUser(locale: Locale = "en") {
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  return session.user;
}

export async function createJobApplicationAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = createApplicationSchema.parse({
    companyName: formValue(formData, "companyName"),
    jobTitle: formValue(formData, "jobTitle"),
    jobUrl: formValue(formData, "jobUrl"),
    location: formValue(formData, "location"),
    salaryRange: formValue(formData, "salaryRange"),
    status: formValue(formData, "status") || JobApplicationStatus.bookmarked,
    priority: formValue(formData, "priority") || Priority.medium,
    appliedDate: formValue(formData, "appliedDate"),
    followUpDate: formValue(formData, "followUpDate"),
    recruiterName: formValue(formData, "recruiterName"),
    recruiterEmail: formValue(formData, "recruiterEmail"),
    recruiterPhone: formValue(formData, "recruiterPhone"),
    notes: formValue(formData, "notes"),
    tags: formValue(formData, "tags"),
  });

  const application = await prisma.jobApplication.create({
    data: {
      userId: user.id,
      companyName: parsed.companyName,
      jobTitle: parsed.jobTitle,
      jobUrl: parsed.jobUrl,
      location: parsed.location,
      salaryRange: parsed.salaryRange,
      status: parsed.status,
      priority: parsed.priority,
      appliedDate: optionalDate(parsed.appliedDate),
      followUpDate: optionalDate(parsed.followUpDate),
      recruiterName: parsed.recruiterName,
      recruiterEmail: parsed.recruiterEmail,
      recruiterPhone: parsed.recruiterPhone,
      notes: parsed.notes,
      tags: parsed.tags,
    },
  });

  if (parsed.notes) {
    await prisma.applicationNote.create({
      data: {
        applicationId: application.id,
        note: parsed.notes,
      },
    });
  }

  if (parsed.followUpDate) {
    await prisma.followUpReminder.create({
      data: {
        applicationId: application.id,
        reminderDate: optionalDate(parsed.followUpDate) ?? new Date(),
        message: parsed.notes || `Follow up with ${parsed.companyName}`,
      },
    });
  }

  redirect(`/${locale}/job-tracker`);
}

export async function updateJobApplicationStatusAction(input: z.infer<typeof statusUpdateSchema>) {
  const user = await requireUser();
  const parsed = statusUpdateSchema.parse(input);
  const application = await prisma.jobApplication.findFirst({
    where: { id: parsed.applicationId, userId: user.id },
  });

  if (!application) {
    return { success: false as const };
  }

  const today = new Date(new Date().toISOString().slice(0, 10));
  const updated = await prisma.jobApplication.update({
    where: { id: application.id },
    data: {
      status: parsed.status,
      appliedDate: parsed.status === JobApplicationStatus.applied && !application.appliedDate ? today : application.appliedDate,
      responseDate:
        ["screening", "interview", "offer", "rejected"].includes(parsed.status) && !application.responseDate
          ? today
          : application.responseDate,
    },
  });

  if (application.status !== parsed.status) {
    await prisma.applicationNote.create({
      data: {
        applicationId: application.id,
        note: `Status changed: ${application.status} -> ${parsed.status}`,
      },
    });
  }

  return { success: true as const, status: updated.status };
}
