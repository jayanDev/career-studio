import type { Metadata } from "next";
import { CheckCircle2, Compass, GraduationCap, Route } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { careerGpsPlanResultSchema } from "@/lib/career-gps";
import { prisma } from "@/lib/prisma";
import { generateCareerGpsPlanAction } from "@/server/actions/career-gps/generate-plan";

type CareerGpsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CareerGpsPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.careerGps" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CareerGpsPage({ params, searchParams }: CareerGpsPageProps) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.careerGps" });
  const session = await auth();
  const action = generateCareerGpsPlanAction.bind(null, locale);
  const selectedPlanId = single(query.plan);
  const userSessions = session?.user?.id
    ? await prisma.careerGPSSession.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
      })
    : [];
  const plans = userSessions.length
    ? await prisma.careerGPSPlan.findMany({
        where: { sessionId: { in: userSessions.map((item) => item.id) } },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];
  const selectedPlan = selectedPlanId ? plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] : plans[0];
  const parsedPlan = selectedPlan ? careerGpsPlanResultSchema.safeParse(selectedPlan.planJson) : null;
  const milestones = selectedPlan
    ? await prisma.careerGPSMilestone.findMany({
        where: { planId: selectedPlan.id },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const tasks = milestones.length
    ? await prisma.careerGPSTask.findMany({
        where: { milestoneId: { in: milestones.map((milestone) => milestone.id) } },
        orderBy: [{ week: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("wizardTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              <Textarea name="currentProfile" rows={8} placeholder={t("profilePlaceholder")} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="primaryRole" placeholder={t("primaryRole")} required />
                <Input name="secondaryRole" placeholder={t("secondaryRole")} />
                <Input name="experienceLevel" placeholder={t("experienceLevel")} />
                <Input name="learningStyle" placeholder={t("learningStyle")} />
              </div>
              <select name="timeframe" className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                <option value="TWO_WEEKS">{t("twoWeeks")}</option>
                <option value="THREE_MONTHS">{t("threeMonths")}</option>
                <option value="ONE_YEAR">{t("oneYear")}</option>
              </select>
              <Textarea name="constraints" rows={4} placeholder={t("constraints")} />
              <Button type="submit" className="w-full bg-teal-700 text-white hover:bg-teal-800">
                <Compass className="size-4" />
                {t("generate")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("planTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {parsedPlan?.success ? (
              <>
                <div className="rounded-lg border bg-teal-50 p-5">
                  <div className="flex items-start gap-3">
                    <Route className="mt-1 size-5 text-teal-800" />
                    <div>
                      <h2 className="text-xl font-semibold text-teal-950">{parsedPlan.data.career_paths[0]?.role ?? t("targetRole")}</h2>
                      <p className="mt-1 text-sm text-teal-900/75">{t("match")}: {parsedPlan.data.career_paths[0]?.match ?? 0}%</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {parsedPlan.data.skill_gaps.must_learn.map((gap) => (
                    <div key={gap.skill} className="rounded-md border bg-neutral-50 p-4">
                      <div className="font-medium text-neutral-950">{gap.skill}</div>
                      <p className="mt-1 text-sm leading-6 text-neutral-600">{gap.reason}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {milestones.map((milestone) => (
                    <section key={milestone.id} className="rounded-lg border bg-neutral-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-neutral-950">{milestone.title}</h3>
                          <p className="mt-1 text-sm text-neutral-600">{milestone.description}</p>
                        </div>
                        <Badge variant="outline" className="rounded-md">{t("weeks")} {milestone.weekStart}-{milestone.weekEnd}</Badge>
                      </div>
                      <div className="mt-4 space-y-2">
                        {tasks.filter((task) => task.milestoneId === milestone.id).map((task) => (
                          <div key={task.id} className="flex gap-3 rounded-md bg-white p-3">
                            <CheckCircle2 className="mt-0.5 size-4 text-teal-700" />
                            <div>
                              <div className="font-medium text-neutral-950">{task.title}</div>
                              <div className="mt-1 text-xs text-neutral-500">{t("week")} {task.week} - {task.type} - {task.effortMinutes} {t("minutes")}</div>
                              <p className="mt-2 text-sm leading-6 text-neutral-600">{task.outcome}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <GraduationCap className="mx-auto size-10 text-teal-700" />
                <h2 className="mt-4 text-lg font-semibold text-neutral-950">{t("emptyPlanTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{t("emptyPlanBody")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
