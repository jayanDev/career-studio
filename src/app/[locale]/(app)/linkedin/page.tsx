import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Network, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startLinkedInAuditAction } from "@/server/actions/linkedin/audit";

type LinkedInPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LinkedInPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.linkedin" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LinkedInPage({ params }: LinkedInPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.linkedin" });
  const session = await auth();
  const action = startLinkedInAuditAction.bind(null, locale);
  const audits = session?.user?.id
    ? await prisma.linkedInAudit.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("auditTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-4">
              <Input name="targetRole" placeholder={t("targetRole")} required />
              <Input name="profileFile" type="file" accept=".pdf,.txt,.doc,.docx" />
              <Textarea name="profileText" rows={11} placeholder={t("profileText")} />
              <Button type="submit" className="w-full bg-teal-700 text-white hover:bg-teal-800">
                <Sparkles className="size-4" />
                {t("runAudit")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {audits.map((audit) => (
              <Link key={audit.id} href={`/${locale}/linkedin/${audit.id}`} className="block rounded-md border bg-neutral-50 p-4 transition hover:bg-neutral-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-neutral-950">{audit.targetRole || t("generalProfile")}</div>
                    <div className="mt-1 text-xs text-neutral-500">{audit.createdAt.toLocaleDateString("en-LK")}</div>
                  </div>
                  <Badge variant="outline" className="rounded-md">{audit.status}</Badge>
                </div>
              </Link>
            ))}
            {audits.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Network className="mx-auto size-10 text-teal-700" />
                <h2 className="mt-4 font-semibold text-neutral-950">{t("emptyHistoryTitle")}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-600">{t("emptyHistoryBody")}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[t("stepUpload"), t("stepAnalyze"), t("stepRewrite")].map((step) => (
          <div key={step} className="rounded-lg border bg-white p-5">
            <FileText className="size-5 text-teal-700" />
            <p className="mt-3 text-sm leading-6 text-neutral-700">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
