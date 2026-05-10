import type { Metadata } from "next";
import { BadgeDollarSign, MapPinned, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SalaryCalculatorClient } from "@/components/feature/salary/salary-calculator-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

type SalaryPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: SalaryPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.salary" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function SalaryPage({ params }: SalaryPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.salary" });
  const session = await auth();
  const [salaryRows, colRows, calculations] = session?.user?.id
    ? await Promise.all([
        prisma.salaryData.findMany({
          where: { country: "Sri Lanka" },
          select: { jobTitle: true, city: true, salaryMedian: true, sampleSize: true },
          take: 500,
        }),
        prisma.costOfLivingData.findMany({
          where: { country: "Sri Lanka" },
          orderBy: { overallIndex: "desc" },
          take: 24,
        }),
        prisma.salaryCalculation.findMany({
          where: { userId: session.user.id },
          orderBy: { calculatedAt: "desc" },
          take: 5,
        }),
      ])
    : [[], [], []];
  const jobTitles = Array.from(new Set(salaryRows.map((row) => row.jobTitle))).sort();
  const cities = Array.from(new Set(colRows.map((row) => row.city))).sort();
  const topRoles = salaryRows
    .filter((row) => row.salaryMedian)
    .sort((left, right) => Number(right.salaryMedian) - Number(left.salaryMedian))
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard icon={BadgeDollarSign} title={t("lkrTitle")} body={t("lkrBody")} />
        <InfoCard icon={MapPinned} title={t("colTitle")} body={t("colBody")} />
        <InfoCard icon={ShieldCheck} title={t("privacyTitle")} body={t("privacyBody")} />
      </div>

      <SalaryCalculatorClient
        jobTitles={jobTitles}
        cities={cities}
        labels={{
          calculatorTitle: t("calculatorTitle"),
          jobTitle: t("jobTitle"),
          experience: t("experience"),
          city: t("city"),
          compareCity: t("compareCity"),
          currency: t("currency"),
          calculate: t("calculate"),
          result: t("result"),
          median: t("median"),
          range: t("range"),
          sampleSize: t("sampleSize"),
          colAdjusted: t("colAdjusted"),
        }}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("topRoles")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topRoles.map((row) => (
              <div key={`${row.jobTitle}-${row.city}`} className="flex items-center justify-between rounded-md border bg-neutral-50 p-3">
                <div>
                  <div className="font-medium text-neutral-950">{row.jobTitle}</div>
                  <div className="text-xs text-neutral-500">{row.city}</div>
                </div>
                <div className="text-sm font-semibold text-teal-700">{formatCurrency(Number(row.salaryMedian))}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("recentCalculations")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {calculations.map((calculation) => (
              <div key={calculation.id} className="flex items-center justify-between rounded-md border bg-neutral-50 p-3">
                <div>
                  <div className="font-medium text-neutral-950">{calculation.jobTitle}</div>
                  <div className="text-xs text-neutral-500">{calculation.location}</div>
                </div>
                <div className="text-sm font-semibold text-teal-700">{formatCurrency(Number(calculation.salaryMedian))}</div>
              </div>
            ))}
            {calculations.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyHistory")}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: typeof BadgeDollarSign; title: string; body: string }) {
  return (
    <Card className="bg-white">
      <CardContent className="p-5">
        <div className="flex size-11 items-center justify-center rounded-md bg-teal-100 text-teal-800">
          <Icon className="size-5" />
        </div>
        <h2 className="mt-4 font-semibold text-neutral-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">{body}</p>
      </CardContent>
    </Card>
  );
}
