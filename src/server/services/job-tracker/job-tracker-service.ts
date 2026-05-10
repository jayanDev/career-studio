import type { JobApplication, JobApplicationStatus } from "@prisma/client";

import { activeJobStatuses, jobStatuses, type JobApplicationCard, type JobTrackerStats } from "@/lib/job-tracker";
import { prisma } from "@/lib/prisma";

function toCard(application: JobApplication): JobApplicationCard {
  return {
    id: application.id,
    companyName: application.companyName,
    jobTitle: application.jobTitle,
    jobUrl: application.jobUrl,
    location: application.location,
    salaryRange: application.salaryRange,
    status: application.status,
    priority: application.priority,
    appliedDate: application.appliedDate?.toISOString().slice(0, 10) ?? null,
    followUpDate: application.followUpDate?.toISOString().slice(0, 10) ?? null,
    recruiterName: application.recruiterName,
    notes: application.notes,
    tags: application.tags,
    updatedAt: application.updatedAt.toISOString(),
  };
}

function startOfWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy.toISOString().slice(0, 10);
}

export async function getJobTrackerDashboard(userId: string) {
  const [applications, reminders] = await Promise.all([
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.followUpReminder.findMany({
      where: {
        isCompleted: false,
        reminderDate: {
          gte: new Date(new Date().toISOString().slice(0, 10)),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        applicationId: {
          in: await prisma.jobApplication
            .findMany({ where: { userId }, select: { id: true } })
            .then((rows) => rows.map((row) => row.id)),
        },
      },
      orderBy: { reminderDate: "asc" },
      take: 5,
    }),
  ]);

  const statusCounts = Object.fromEntries(jobStatuses.map((status) => [status, 0])) as Record<JobApplicationStatus, number>;
  const weeklyMap = new Map<string, number>();
  const companies = new Set<string>();
  let responseDaysTotal = 0;
  let responseDaysCount = 0;

  for (const application of applications) {
    statusCounts[application.status] += 1;
    if (application.companyName.trim()) companies.add(application.companyName.trim().toLowerCase());
    const week = startOfWeek(application.createdAt);
    weeklyMap.set(week, (weeklyMap.get(week) ?? 0) + 1);
    if (application.appliedDate && application.responseDate) {
      responseDaysTotal += Math.max(0, Math.round((application.responseDate.getTime() - application.appliedDate.getTime()) / 86_400_000));
      responseDaysCount += 1;
    }
  }

  const total = applications.length;
  const active = activeJobStatuses.reduce((sum, status) => sum + statusCounts[status], 0);
  const offers = statusCounts.offer + statusCounts.accepted;
  const rejected = statusCounts.rejected;
  const appliedTotal = total - statusCounts.bookmarked;
  const responded = active + offers + rejected;
  const stats: JobTrackerStats = {
    total,
    active,
    offers,
    rejected,
    responseRate: appliedTotal > 0 ? Math.round((responded / appliedTotal) * 1000) / 10 : 0,
    totalCompanies: companies.size,
    avgResponseDays: responseDaysCount > 0 ? Math.round(responseDaysTotal / responseDaysCount) : null,
    statusCounts,
    weeklyApplications: Array.from(weeklyMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-8)
      .map(([week, count]) => ({ week, count })),
  };

  return {
    stats,
    applications: applications.map(toCard),
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      applicationId: reminder.applicationId,
      reminderDate: reminder.reminderDate.toISOString().slice(0, 10),
      message: reminder.message,
    })),
  };
}
