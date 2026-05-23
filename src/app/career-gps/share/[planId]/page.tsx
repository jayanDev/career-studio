import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { careerGpsPlanResultSchema } from "@/lib/career-gps";
import { prisma } from "@/lib/prisma";
import { recordShareView } from "@/lib/share-views";

type SharedCareerGpsPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function SharedCareerGpsPage({ params }: SharedCareerGpsPageProps) {
  const { planId } = await params;
  const plan = await prisma.careerGPSPlan.findUnique({ where: { id: planId } });
  if (!plan) notFound();
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Career GPS Roadmap</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">{data.identity_statement}</p>
          </div>
          <Badge className="rounded-md bg-teal-700 text-white">{data.plan_strength.score}/100</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {data.pathways.map((pathway) => (
            <Card key={pathway.type} className="bg-white">
              <CardHeader>
                <Badge variant="outline" className="w-fit rounded-md">{pathway.type}</Badge>
                <CardTitle>{pathway.role}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-neutral-600">{pathway.summary}</p>
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
            {data.skill_overlap.gaps.map((gap) => (
              <Badge key={gap} variant="outline" className="rounded-md border-red-200 text-red-700">{gap}</Badge>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {data.roadmap.milestones.map((milestone) => (
            <Card key={`${milestone.week_start}-${milestone.title}`} className="bg-white">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{milestone.title}</CardTitle>
                  <Badge variant="outline" className="rounded-md">Weeks {milestone.week_start}-{milestone.week_end}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-neutral-600">{milestone.description}</p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-700">
                  {milestone.tasks.map((task) => (
                    <li key={`${task.week}-${task.title}`} className="rounded-md bg-neutral-50 p-3">
                      Week {task.week}: {task.title}
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
