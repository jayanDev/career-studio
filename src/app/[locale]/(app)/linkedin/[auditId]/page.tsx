import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { linkedInAuditResultSchema } from "@/lib/linkedin-audit";
import { prisma } from "@/lib/prisma";
import { requestLinkedInRewriteAction } from "@/server/actions/linkedin/audit";

type LinkedInAuditPageProps = {
  params: Promise<{ locale: string; auditId: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LinkedInAuditPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.linkedinAudit" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LinkedInAuditPage({ params }: LinkedInAuditPageProps) {
  const { locale: rawLocale, auditId } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.linkedin" });
  const session = await auth();
  const audit = session?.user?.id
    ? await prisma.linkedInAudit.findFirst({
        where: { id: auditId, userId: session.user.id },
      })
    : null;

  if (!audit) {
    return (
      <div className="rounded-lg border bg-white p-8">
        <Button asChild variant="outline">
          <Link href={`/${locale}/linkedin`}>{t("back")}</Link>
        </Button>
      </div>
    );
  }

  const [resultRecord, rewrites] = await Promise.all([
    prisma.linkedInAuditResult.findUnique({ where: { auditId: audit.id } }),
    prisma.linkedInRewriteSuggestion.findMany({ where: { auditId: audit.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const parsed = resultRecord
    ? linkedInAuditResultSchema.safeParse({
        score_breakdown: resultRecord.scoreBreakdown,
        missing_keywords: resultRecord.missingKeywords,
        section_scores: resultRecord.sectionScores,
        checklist_items: resultRecord.checklistItems,
        summary_feedback: resultRecord.summaryFeedback,
      })
    : null;
  const action = requestLinkedInRewriteAction.bind(null, locale, audit.id);
  const scores = parsed?.success ? Object.entries(parsed.data.score_breakdown) : [];
  const overall = scores.length ? Math.round(scores.reduce((sum, [, value]) => sum + value, 0) / scores.length) : 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="outline">
        <Link href={`/${locale}/linkedin`}>
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{audit.targetRole || t("generalProfile")}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t("auditResultSubtitle")}</p>
        </div>
        <div className="rounded-lg border bg-white px-5 py-3 text-center">
          <div className="text-3xl font-semibold text-teal-700">{overall}</div>
          <div className="text-xs text-neutral-500">{t("overallScore")}</div>
        </div>
      </div>

      {parsed?.success ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>{t("scoreBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {scores.map(([key, value]) => (
                  <div key={key} className="rounded-md border bg-neutral-50 p-4">
                    <div className="text-xl font-semibold text-neutral-950">{value}</div>
                    <div className="mt-1 text-xs text-neutral-500">{key.replaceAll("_", " ")}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>{t("missingKeywords")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parsed.data.missing_keywords.map((keyword) => (
                  <div key={`${keyword.keyword}-${keyword.placement}`} className="rounded-md border bg-neutral-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-950">{keyword.keyword}</span>
                      <Badge variant="outline" className="rounded-md">{keyword.priority}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{keyword.placement}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>{t("checklist")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {parsed.data.checklist_items.map((item) => (
                  <div key={item.id} className="flex gap-3 rounded-md border bg-neutral-50 p-3">
                    <CheckCircle2 className={`mt-0.5 size-4 ${item.completed ? "text-teal-700" : "text-neutral-300"}`} />
                    <div>
                      <div className="font-medium text-neutral-950">{item.label}</div>
                      <div className="mt-1 text-xs text-neutral-500">{item.impact}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-white">
              <CardHeader>
                <CardTitle>{t("rewriteTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={action} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
                  <select name="sectionType" className="h-9 rounded-md border bg-white px-3 text-sm">
                    <option value="headline">{t("headline")}</option>
                    <option value="about">{t("about")}</option>
                    <option value="experience">{t("experience")}</option>
                  </select>
                  <select name="tone" className="h-9 rounded-md border bg-white px-3 text-sm">
                    <option value="STANDARD">{t("standard")}</option>
                    <option value="PUNCHY">{t("punchy")}</option>
                    <option value="LEADERSHIP">{t("leadership")}</option>
                  </select>
                  <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                    <Sparkles className="size-4" />
                    {t("rewrite")}
                  </Button>
                </form>
                {rewrites.map((rewrite) => (
                  <div key={rewrite.id} className="rounded-md border bg-teal-50 p-4">
                    <div className="mb-2 text-xs font-medium uppercase text-teal-800">{rewrite.sectionType}</div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-teal-950">{rewrite.rewritten}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="bg-white">
          <CardContent className="p-8 text-sm text-neutral-600">{t("processing")}</CardContent>
        </Card>
      )}
    </div>
  );
}
