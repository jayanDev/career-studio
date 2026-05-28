import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Network } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AiUnavailableBanner, isAiAvailable } from "@/components/ai-unavailable-banner";
import { LinkedInClient } from "@/components/feature/linkedin/linkedin-client";

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
      {isAiAvailable() ? null : <AiUnavailableBanner reason="no_key" />}

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <LinkedInClient t={t} locale={locale} />
        </div>

        <div className="space-y-6">
          <Card className="bg-white border-neutral-100 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">{t("history")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {audits.map((audit) => (
                <Link key={audit.id} href={`/${locale}/linkedin/${audit.id}`} className="block rounded-md border border-neutral-100 bg-neutral-50/50 p-4 transition hover:bg-neutral-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-neutral-950 text-sm">{audit.targetRole || t("generalProfile")}</div>
                      <div className="mt-1 text-xs text-neutral-500">{audit.createdAt.toLocaleDateString("en-LK")}</div>
                    </div>
                    <Badge variant="outline" className="rounded-md text-[10px] uppercase font-bold">{audit.status}</Badge>
                  </div>
                </Link>
              ))}
              {audits.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Network className="mx-auto size-8 text-teal-700" />
                  <h2 className="mt-3 text-sm font-semibold text-neutral-950">{t("emptyHistoryTitle")}</h2>
                  <p className="mt-1 text-xs text-neutral-500 leading-5">{t("emptyHistoryBody")}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 border-t pt-6">
        {[t("stepUpload"), t("stepAnalyze"), t("stepRewrite")].map((step) => (
          <div key={step} className="rounded-lg border bg-white p-5 shadow-xs">
            <FileText className="size-5 text-teal-700" />
            <p className="mt-3 text-xs leading-5 text-neutral-600 font-medium">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
