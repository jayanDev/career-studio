import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { linkedInAuditResultSchema } from "@/lib/linkedin-audit";
import { prisma } from "@/lib/prisma";
import { recordShareView } from "@/lib/share-views";

type PublicLinkedInAuditPageProps = {
  params: Promise<{ auditId: string }>;
};

export default async function PublicLinkedInAuditPage({ params }: PublicLinkedInAuditPageProps) {
  const { auditId } = await params;
  const audit = await prisma.linkedInAudit.findUnique({ where: { id: auditId } });
  if (!audit) notFound();

  const [resultRecord, extractedProfile] = await Promise.all([
    prisma.linkedInAuditResult.findUnique({ where: { auditId } }),
    prisma.linkedInExtractedProfile.findUnique({ where: { auditId } }),
  ]);
  if (!resultRecord) notFound();

  await recordShareView({
    type: "linkedin",
    itemId: auditId,
    ownerId: audit.userId,
    headers: await headers(),
  });

  const dataJson = (extractedProfile?.dataJson as Record<string, unknown>) || {};
  const parsed = linkedInAuditResultSchema.parse({
    score_breakdown: resultRecord.scoreBreakdown,
    missing_keywords: resultRecord.missingKeywords,
    section_scores: resultRecord.sectionScores,
    checklist_items: resultRecord.checklistItems,
    summary_feedback: resultRecord.summaryFeedback,
    headline_analysis: dataJson.headline_analysis || {},
    about_analysis: dataJson.about_analysis || {},
    rec_endorsement_analysis: dataJson.rec_endorsement_analysis || {},
    featured_audit: dataJson.featured_audit || {},
    open_to_work_audit: dataJson.open_to_work_audit || {},
    sri_lanka_moat: dataJson.sri_lanka_moat || {},
    profile_media_audit: dataJson.profile_media_audit || {},
    jd_keyword_analysis: dataJson.jd_keyword_analysis || {},
    activity_analysis: dataJson.activity_analysis || {},
    skills_optimizer: dataJson.skills_optimizer || {},
    benchmark: dataJson.benchmark || {},
  });
  const overall = Math.round(
    parsed.score_breakdown.profile_strength +
      parsed.score_breakdown.authority +
      parsed.score_breakdown.findability +
      parsed.score_breakdown.engagement_readiness
  );

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge variant="outline" className="text-[10px] uppercase">Public LinkedIn Audit</Badge>
            <h1 className="mt-3 text-2xl font-bold text-slate-950">{audit.targetRole || "LinkedIn profile"}</h1>
            <p className="mt-1 text-sm text-slate-600">Privacy-safe public report. Raw profile text and contact details are hidden.</p>
          </div>
          <div className="rounded-full border-4 border-teal-500 bg-teal-50 px-5 py-4 text-center">
            <div className="text-3xl font-extrabold text-teal-700">{overall}</div>
            <div className="text-[10px] font-bold uppercase text-teal-700">/100</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Profile", parsed.score_breakdown.profile_strength],
            ["Authority", parsed.score_breakdown.authority],
            ["Findability", parsed.score_breakdown.findability],
            ["Engagement", parsed.score_breakdown.engagement_readiness],
          ].map(([label, score]) => (
            <Card key={label} className="bg-white">
              <CardContent className="p-4">
                <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{score as number}/25</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">Top Improvements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {parsed.missing_keywords.slice(0, 6).map((item) => (
                <div key={`${item.keyword}-${item.placement}`} className="rounded-md border bg-slate-50 p-3 text-sm">
                  <strong>{item.keyword}</strong>
                  <p className="text-xs text-slate-500">{item.placement}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-base">Benchmark</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p className="font-semibold">{parsed.benchmark.peer_label}</p>
              {parsed.benchmark.gaps.slice(0, 4).map((gap) => (
                <p key={gap}>{gap}</p>
              ))}
              <p className="pt-2 text-xs text-teal-700">Next audit target: {parsed.benchmark.reaudit_recommended_on || "30 days"}</p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-xs text-slate-500">
          <Link href="/" className="font-semibold text-teal-700">Career Studio</Link>
        </div>
      </div>
    </main>
  );
}
