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

async function getRecommendationsForSkills(skills: string[]) {
  if (!skills || skills.length === 0) {
    return { courses: [], mentors: [] };
  }

  try {
    const courses = await prisma.course.findMany({
      where: {
        OR: skills.flatMap((skill) => [
          { title: { contains: skill, mode: "insensitive" } },
          { summary: { contains: skill, mode: "insensitive" } },
          { tag1: { contains: skill, mode: "insensitive" } },
          { tag2: { contains: skill, mode: "insensitive" } },
        ]),
      },
      take: 4,
    });

    const mentors = await prisma.mentorProfile.findMany({
      where: { isActive: true },
    });

    const userIds = mentors.map((m) => m.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        image: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    const mentorsWithUsers = mentors
      .map((m) => ({
        ...m,
        user: userMap.get(m.userId)!,
      }))
      .filter((m) => m.user !== undefined);

    const matchedMentors = mentorsWithUsers
      .filter((mentor) => {
        const bioText = mentor.bio.toLowerCase();
        const expertiseList = Array.isArray(mentor.expertise)
          ? (mentor.expertise as string[]).map((e) => e.toLowerCase())
          : [];
        return skills.some((skill) => {
          const sLower = skill.toLowerCase();
          return (
            bioText.includes(sLower) ||
            expertiseList.some((exp) => exp.includes(sLower) || sLower.includes(exp))
          );
        });
      })
      .slice(0, 4);

    return { courses, mentors: matchedMentors };
  } catch (error) {
    console.error("Failed to fetch skill gap matches:", error);
    return { courses: [], mentors: [] };
  }
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

  const skillsToMatch = parsedPlan?.success
    ? parsedPlan.data.skill_gaps.must_learn.map((gap) => gap.skill)
    : [];
  const recommendations = await getRecommendationsForSkills(skillsToMatch);

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

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                    <GraduationCap className="size-5 text-teal-700" />
                    Recommended Learning & Mentors
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Direct matched resources from Career Studio's directory to bridge your identified skill gaps.
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Courses */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">Matched Courses</h4>
                      {recommendations.courses.length > 0 ? (
                        <div className="space-y-2">
                          {recommendations.courses.map((course) => (
                            <div key={course.id} className="rounded-md border bg-white p-3.5 shadow-sm flex flex-col justify-between gap-2 hover:shadow transition">
                              <div>
                                <div className="font-medium text-neutral-900 text-xs">{course.title}</div>
                                <div className="text-[10px] text-neutral-500 mt-0.5">{course.provider} • {course.deliveryMode || "Online"}</div>
                              </div>
                              {course.officialUrl && (
                                <a
                                  href={course.officialUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-700 hover:text-teal-800 hover:underline font-semibold w-fit"
                                >
                                  View Course &rarr;
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No direct courses match these gaps currently.</p>
                      )}
                    </div>

                    {/* Mentors */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-neutral-800 text-xs uppercase tracking-wider">Expert Mentors</h4>
                      {recommendations.mentors.length > 0 ? (
                        <div className="space-y-2">
                          {recommendations.mentors.map((mentor) => {
                            const name = [mentor.user.firstName, mentor.user.lastName].filter(Boolean).join(" ") || mentor.user.email;
                            const expertise = Array.isArray(mentor.expertise) ? (mentor.expertise as string[]) : [];
                            return (
                              <div key={mentor.id} className="rounded-md border bg-white p-3.5 shadow-sm flex flex-col gap-2 hover:shadow transition">
                                <div>
                                  <div className="font-medium text-neutral-900 text-xs">{name}</div>
                                  <p className="text-[10px] text-neutral-600 mt-1 line-clamp-2">{mentor.bio}</p>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {expertise.slice(0, 3).map((exp) => (
                                    <Badge key={exp} variant="outline" className="text-[9px] py-0 px-1.5 bg-neutral-50 border-neutral-200">
                                      {exp}
                                    </Badge>
                                  ))}
                                </div>
                                <a
                                  href={`/${locale}/mentorship`}
                                  className="text-[10px] text-teal-700 hover:text-teal-800 hover:underline font-semibold w-fit mt-1"
                                >
                                  Request Session &rarr;
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No mentors matching these specific skills yet.</p>
                      )}
                    </div>
                  </div>
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
