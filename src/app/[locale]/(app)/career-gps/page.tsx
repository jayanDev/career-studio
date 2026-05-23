import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Brain, CheckCircle2, Compass, Globe2, GraduationCap, Lock, Route, Share2, Sparkles, Target, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ShareToggleButton } from "@/components/share-toggle-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { careerGpsPlanResultSchema } from "@/lib/career-gps";
import { planStrengthLabel } from "@/lib/career-gps-insights";
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
  const planRecord = selectedPlan?.planJson && typeof selectedPlan.planJson === "object"
    ? selectedPlan.planJson as Record<string, unknown>
    : {};
  const maxWeeksUnlocked = typeof planRecord.max_weeks_unlocked === "number" ? planRecord.max_weeks_unlocked : 2;
  const planData = parsedPlan?.success ? parsedPlan.data : null;
  const doneTasks = tasks.filter((task) => task.isDone).length;
  const progressPct = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

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
              <div className="rounded-md border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-teal-950">
                  <Sparkles className="size-4" />
                  Identity-first discovery
                </div>
                <p className="mt-1 text-xs leading-5 text-teal-800">
                  Tell the story first. Career GPS will turn it into an identity statement, career constellation, pathways, and skill gaps.
                </p>
                <Textarea
                  name="identityStory"
                  rows={6}
                  className="mt-3 bg-white"
                  placeholder="Tell us about what you have done, what you enjoyed, what drained you, what people ask you for help with, and what you are curious about."
                />
              </div>
              <Textarea name="currentProfile" rows={8} placeholder={t("profilePlaceholder")} required />
              <div className="grid gap-4 md:grid-cols-2">
                <Input name="primaryRole" placeholder={t("primaryRole")} required />
                <Input name="secondaryRole" placeholder={t("secondaryRole")} />
                <Input name="experienceLevel" placeholder={t("experienceLevel")} />
                <Input name="learningStyle" placeholder={t("learningStyle")} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <select name="ambitionMode" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="local">Local SL ambition</option>
                  <option value="global">Global ambition</option>
                  <option value="hybrid">Hybrid: local to global</option>
                </select>
                <select name="sectorPreference" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="either">Public or private</option>
                  <option value="private">Private sector</option>
                  <option value="public">Public sector</option>
                </select>
                <select name="languageMode" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="en">English</option>
                  <option value="si">Sinhala discovery</option>
                  <option value="ta">Tamil discovery</option>
                </select>
                <select name="alStream" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="">A/L or pathway context</option>
                  <option value="Physical Science">Physical Science</option>
                  <option value="Bio Science">Bio Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts</option>
                  <option value="Vocational">Vocational / HND</option>
                </select>
                <Input name="hollandCode" placeholder="Holland code e.g. IAS" maxLength={3} />
                <Input name="familyExpectation" type="number" min={0} max={10} placeholder="Family expectations 0-10" defaultValue={5} />
              </div>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm text-neutral-700">
                <input type="checkbox" name="diasporaMode" />
                I am Sri Lankan abroad or considering returning to Sri Lanka
              </label>
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
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="rounded-lg border bg-neutral-50 p-5">
                    <div className="flex items-start gap-3">
                      <Brain className="mt-1 size-5 text-teal-700" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Identity Statement</p>
                        <p className="mt-2 text-sm leading-7 text-neutral-800">{planData?.identity_statement}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white p-5 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Plan Strength</p>
                      <div className="mt-2 text-4xl font-semibold text-neutral-950">{planData?.plan_strength.score ?? 0}</div>
                      <p className="mt-1 text-xs leading-5 text-neutral-600">{planData?.plan_strength.label || planStrengthLabel(planData?.plan_strength.score ?? 0)}</p>
                    </div>
                    {selectedPlan ? (
                      <div className="border-t pt-3">
                        <ShareToggleButton
                          kind="career-gps"
                          id={selectedPlan.id}
                          initiallyShared={!!selectedPlan.shareToken}
                          initialToken={selectedPlan.shareToken}
                          locale={locale}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-neutral-950">Visual Career Constellation</h3>
                      <p className="mt-1 text-xs text-neutral-500">Node size follows match strength. Colour follows career domain.</p>
                    </div>
                    <Badge variant="outline" className="rounded-md">{planData?.constellation.length ?? 0} careers</Badge>
                  </div>
                  <div className="relative mt-4 h-[360px] overflow-hidden rounded-lg bg-neutral-950">
                    <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-teal-300 bg-teal-400/20 text-center text-xs font-semibold text-teal-50">
                      Your identity
                    </div>
                    {planData?.constellation.map((node) => (
                      <div
                        key={node.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 p-2 text-center text-[10px] leading-4 text-white shadow"
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          width: `${64 + node.match / 2}px`,
                          height: `${64 + node.match / 2}px`,
                          backgroundColor: domainColor(node.domain),
                        }}
                        title={`${node.role}: ${node.summary}`}
                      >
                        <span className="line-clamp-3">{node.role}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {planData?.constellation.slice(0, 6).map((node) => (
                      <div key={node.id} className="rounded-md border bg-neutral-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-neutral-950">{node.role}</div>
                          <Badge variant="outline" className="rounded-md">{node.match}%</Badge>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-neutral-600">{node.summary}</p>
                        <p className="mt-2 text-xs text-neutral-500">{node.salary_lkr} - {node.difficulty_label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {planData?.pathways.map((pathway) => (
                    <div key={pathway.type} className="rounded-lg border bg-white p-4">
                      <Badge className="rounded-md bg-teal-700 text-white">{pathway.type}</Badge>
                      <h3 className="mt-3 font-semibold text-neutral-950">{pathway.role}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{pathway.summary}</p>
                      <p className="mt-3 text-xs text-neutral-500">{pathway.time_to_transition_months} months - {pathway.risk}</p>
                      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
                        {pathway.salary_curve_lkr.map((point) => (
                          <div key={point.year} className="rounded bg-neutral-50 p-1">
                            <div className="font-semibold">Y{point.year}</div>
                            <div>Rs {Math.round(point.p25 / 1000)}k-{Math.round(point.p75 / 1000)}k</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-lg border bg-white p-5">
                    <h3 className="font-semibold text-neutral-950">Skill Overlap</h3>
                    <div className="mt-4 grid place-items-center">
                      <div className="grid size-32 place-items-center rounded-full border-[18px] border-red-200" style={{ borderTopColor: "#0f766e", borderRightColor: "#0f766e" }}>
                        <span className="text-3xl font-semibold text-neutral-950">{planData?.skill_overlap.overlap_pct ?? 0}%</span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs">
                      <TagList title="Transferable" items={planData?.skill_overlap.transferable ?? []} tone="green" />
                      <TagList title="Gaps" items={planData?.skill_overlap.gaps ?? []} tone="red" />
                      <TagList title="Deprioritise" items={planData?.skill_overlap.drop_or_deprioritize ?? []} tone="neutral" />
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white p-5">
                    <h3 className="font-semibold text-neutral-950">Sri Lanka Pathway Context</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <InfoList title="A/L -> Degree -> Role" items={planData?.sl_context.al_stream_pathways ?? []} />
                      <InfoList title="Industry ladders" items={planData?.sl_context.industry_ladders ?? []} />
                      <InfoList title="Local certs" items={planData?.sl_context.certifications ?? []} />
                      <InfoList title="Scholarships" items={planData?.sl_context.scholarships ?? []} />
                    </div>
                    {planData?.sl_context.diaspora_bridge ? (
                      <p className="mt-3 rounded-md bg-blue-50 p-3 text-xs leading-5 text-blue-900">{planData.sl_context.diaspora_bridge}</p>
                    ) : null}
                    <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-5 text-amber-900">{planData?.sl_context.cost_of_living_note}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <MiniPanel icon={<Users className="size-4" />} title="People Like You" items={planData?.people_like_you.map((item) => `${item.percent}% -> ${item.path}: ${item.note}`) ?? []} />
                  <MiniPanel icon={<Share2 className="size-4" />} title="Share With Mentor" items={planData?.share.mentor_notes ?? []} />
                  <MiniPanel icon={<Globe2 className="size-4" />} title="Weekly Check-ins" items={planData?.checkins.slice(0, 4).map((item) => `Week ${item.week}: ${item.prompt}`) ?? []} />
                </div>

                <div className="rounded-lg border bg-teal-50 p-5">
                  <div className="flex items-start gap-3">
                    <Route className="mt-1 size-5 text-teal-800" />
                    <div>
                      <h2 className="text-xl font-semibold text-teal-950">{parsedPlan.data.career_paths[0]?.role ?? t("targetRole")}</h2>
                      <p className="mt-1 text-sm text-teal-900/75">{t("match")}: {parsedPlan.data.career_paths[0]?.match ?? 0}%</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-neutral-950">Week-by-week unlock timeline</h3>
                    <Badge variant="outline" className="rounded-md">{progressPct}% complete</Badge>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: parsedPlan.data.roadmap.weeks }).map((_, index) => {
                      const week = index + 1;
                      const locked = week > maxWeeksUnlocked;
                      const weekTasks = tasks.filter((task) => task.week === week);
                      return (
                        <div key={week} className={`min-w-24 rounded-md border p-3 text-xs ${locked ? "bg-neutral-100 text-neutral-400" : "bg-white text-neutral-700"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">W{week}</span>
                            {locked ? <Lock className="size-3" /> : <Target className="size-3 text-teal-700" />}
                          </div>
                          <p className="mt-1">{locked ? "Upgrade" : `${weekTasks.length} tasks`}</p>
                        </div>
                      );
                    })}
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
                                <div className="text-[10px] text-neutral-500 mt-0.5">{course.provider} - {course.deliveryMode || "Online"}</div>
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

function domainColor(domain: string) {
  const colors: Record<string, string> = {
    Tech: "#0f766e",
    Business: "#2563eb",
    Finance: "#4f46e5",
    Creative: "#be123c",
    Service: "#b45309",
    General: "#525252",
  };
  return colors[domain] ?? colors.General;
}

function TagList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "red" | "neutral" }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-800 border-emerald-100",
    red: "bg-red-50 text-red-800 border-red-100",
    neutral: "bg-neutral-50 text-neutral-700 border-neutral-100",
  };
  return (
    <div>
      <p className="mb-1 font-semibold text-neutral-700">{title}</p>
      <div className="flex flex-wrap gap-1">
        {(items.length ? items : ["None yet"]).map((item) => (
          <span key={item} className={`rounded-md border px-2 py-1 ${styles[tone]}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md bg-neutral-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{title}</p>
      <ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-700">
        {(items.length ? items : ["No direct match yet"]).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function MiniPanel({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="flex items-center gap-2 font-semibold text-neutral-950">{icon}{title}</h3>
      <ul className="mt-3 space-y-2 text-xs leading-5 text-neutral-600">
        {(items.length ? items : ["No data yet"]).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}
