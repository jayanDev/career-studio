import type { Metadata } from "next";
import { BriefcaseBusiness, Send, Target, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { JobTrackerClient } from "@/components/feature/job-tracker/job-tracker-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { jobPriorities, jobStatuses, jobPriorityMeta, jobStatusMeta } from "@/lib/job-tracker";
import { createJobApplicationAction } from "@/server/actions/job-tracker/job-applications";
import { getJobTrackerDashboard } from "@/server/services/job-tracker/job-tracker-service";

type JobTrackerPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: JobTrackerPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.jobTracker" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function JobTrackerPage({ params }: JobTrackerPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.jobTracker" });
  const session = await auth();
  const dashboard = session?.user?.id ? await getJobTrackerDashboard(session.user.id) : null;
  const createAction = createJobApplicationAction.bind(null, locale);
  const stats = dashboard?.stats ?? {
    total: 0,
    active: 0,
    offers: 0,
    rejected: 0,
    responseRate: 0,
    totalCompanies: 0,
    avgResponseDays: null,
    statusCounts: Object.fromEntries(jobStatuses.map((status) => [status, 0])) as Record<(typeof jobStatuses)[number], number>,
    weeklyApplications: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-md border-teal-200 text-teal-700">
          {t("responseRate")}: {stats.responseRate}%
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BriefcaseBusiness} label={t("total")} value={stats.total} />
        <StatCard icon={Send} label={t("active")} value={stats.active} />
        <StatCard icon={Target} label={t("offers")} value={stats.offers} />
        <StatCard icon={TrendingUp} label={t("companies")} value={stats.totalCompanies} />
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAction} className="grid gap-4 lg:grid-cols-4">
            <Input name="companyName" placeholder={t("company")} required />
            <Input name="jobTitle" placeholder={t("role")} required />
            <Input name="jobUrl" placeholder={t("jobUrl")} />
            <Input name="location" placeholder={t("location")} />
            <Input name="salaryRange" placeholder={t("salaryRange")} />
            <select name="status" className="h-9 rounded-md border bg-white px-3 text-sm">
              {jobStatuses.map((status) => (
                <option key={status} value={status}>{jobStatusMeta[status].label}</option>
              ))}
            </select>
            <select name="priority" className="h-9 rounded-md border bg-white px-3 text-sm">
              {jobPriorities.map((priority) => (
                <option key={priority} value={priority}>{jobPriorityMeta[priority].label}</option>
              ))}
            </select>
            <Input name="appliedDate" type="date" aria-label={t("appliedDate")} />
            <Input name="followUpDate" type="date" aria-label={t("followUpDate")} />
            <Input name="recruiterName" placeholder={t("recruiterName")} />
            <Input name="recruiterEmail" placeholder={t("recruiterEmail")} />
            <Input name="tags" placeholder={t("tags")} />
            <Textarea name="notes" className="lg:col-span-3" placeholder={t("notes")} />
            <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
              {t("addApplication")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <JobTrackerClient
        initialApplications={dashboard?.applications ?? []}
        stats={stats}
        labels={{
          kanban: t("kanban"),
          list: t("list"),
          analytics: t("analytics"),
          updated: t("updated"),
          noApplications: t("noApplications"),
          company: t("company"),
          role: t("role"),
          status: t("status"),
          priority: t("priority"),
          location: t("location"),
          weeklyApplications: t("weeklyApplications"),
          statusMix: t("statusMix"),
        }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BriefcaseBusiness; label: string; value: number }) {
  return (
    <Card className="bg-white">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-md bg-teal-100 text-teal-800">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-neutral-950">{value}</div>
          <div className="text-sm text-neutral-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
