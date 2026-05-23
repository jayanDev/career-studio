import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { careerGpsPlanResultSchema } from "@/lib/career-gps";
import { prisma } from "@/lib/prisma";
import { recordShareView } from "@/lib/share-views";
import { maskList, maskText } from "@/lib/share-mask";

type SharedCareerGpsPageProps = {
  params: Promise<{ planId: string }>;
  searchParams: Promise<{ token?: string }>;
};

/**
 * Public Career GPS share page.
 *
 * Gating: a plan is only visible publicly when it has a `shareToken`
 * AND the requesting URL provides the matching `?token=` query param.
 * This prevents anyone with a guessed `planId` UUID from reading a
 * candidate's full identity statement / pathway / roadmap. Every text
 * field that might contain PII is run through the masking helpers
 * before render.
 */
export default async function SharedCareerGpsPage({ params, searchParams }: SharedCareerGpsPageProps) {
  const { planId } = await params;
  const { token } = await searchParams;

  const plan = await prisma.careerGPSPlan.findUnique({ where: { id: planId } });
  if (!plan) notFound();

  // Hard ownership gate: no token on the row OR no token in URL OR mismatch → 404.
  if (!plan.shareToken || !token || plan.shareToken !== token) {
    notFound();
  }

  const session = await prisma.careerGPSSession.findUnique({ where: { id: plan.sessionId } });
  const parsed = careerGpsPlanResultSchema.safeParse(plan.planJson);
  if (!parsed.success) notFound();

  const data = parsed.data;

  await recordShareView({
    type: "career-gps",
    itemId: planId,
    ownerId: session?.userId,
    headers: await headers(),
  });

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 text-neutral-950">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Public Career GPS plan — personal contact details have been redacted. The candidate controls
          this link and can revoke it at any time.
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Career GPS Roadmap (anonymised)</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{maskText(data.identity_statement)}</p>
          </div>
          <Badge className="rounded-md bg-teal-700 text-white">{data.plan_strength.score}/100</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {data.pathways.map((pathway) => (
            <Card key={pathway.type} className="bg-white">
              <CardHeader>
                <Badge variant="outline" className="w-fit rounded-md">{pathway.type}</Badge>
                <CardTitle>{maskText(pathway.role)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-neutral-600">{maskText(pathway.summary)}</p>
                <p className="mt-3 text-xs text-neutral-500">{pathway.time_to_transition_months} months</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Skill Gaps</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {maskList(data.skill_overlap.gaps).map((gap) => (
              <Badge key={gap} variant="outline" className="rounded-md border-red-200 text-red-700">{gap}</Badge>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {data.roadmap.milestones.map((milestone) => (
            <Card key={`${milestone.week_start}-${milestone.title}`} className="bg-white">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{maskText(milestone.title)}</CardTitle>
                  <Badge variant="outline" className="rounded-md">Weeks {milestone.week_start}-{milestone.week_end}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-neutral-600">{maskText(milestone.description)}</p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                  {milestone.tasks.map((task) => (
                    <li key={`${task.week}-${task.title}`} className="rounded-md bg-neutral-50 p-3">
                      Week {task.week}: {maskText(task.title)}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
