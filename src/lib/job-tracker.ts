import type { JobApplicationStatus, Priority } from "@prisma/client";

export const jobStatuses = [
  "bookmarked",
  "applied",
  "screening",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrew",
] as const satisfies readonly JobApplicationStatus[];

export const jobPriorities = ["low", "medium", "high"] as const satisfies readonly Priority[];

export const activeJobStatuses = ["applied", "screening", "interview"] as const satisfies readonly JobApplicationStatus[];

export const jobStatusMeta: Record<
  JobApplicationStatus,
  {
    label: string;
    tone: "neutral" | "blue" | "cyan" | "amber" | "green" | "red" | "slate";
  }
> = {
  bookmarked: { label: "Bookmarked", tone: "neutral" },
  applied: { label: "Applied", tone: "blue" },
  screening: { label: "Screening", tone: "cyan" },
  interview: { label: "Interview", tone: "amber" },
  offer: { label: "Offer", tone: "green" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
  withdrew: { label: "Withdrew", tone: "slate" },
};

export const jobPriorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "border-neutral-200 text-neutral-600" },
  medium: { label: "Medium", className: "border-sky-200 text-sky-700" },
  high: { label: "High", className: "border-rose-200 text-rose-700" },
};

export type JobApplicationCard = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  location: string;
  salaryRange: string;
  status: JobApplicationStatus;
  priority: Priority;
  appliedDate: string | null;
  followUpDate: string | null;
  recruiterName: string;
  notes: string;
  tags: string;
  updatedAt: string;
};

export type JobTrackerStats = {
  total: number;
  active: number;
  offers: number;
  rejected: number;
  responseRate: number;
  totalCompanies: number;
  avgResponseDays: number | null;
  statusCounts: Record<JobApplicationStatus, number>;
  weeklyApplications: Array<{ week: string; count: number }>;
};

export function dateToInputValue(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}
