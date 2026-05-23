import type { Metadata } from "next";
import Link from "next/link";

import { ComparePanel } from "@/components/feature/ats/compare-panel";
import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale } from "@/i18n-config";
import { compareAtsResultsAction } from "@/server/actions/ats/compare";

type ComparePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
};

export const metadata: Metadata = {
  title: "ATS Compare",
  description: "Compare two ATS scans side by side.",
};

export default async function AtsComparePage({ params, searchParams }: ComparePageProps) {
  const { locale: rawLocale } = await params;
  const { a, b } = await searchParams;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  if (!a || !b) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Compare scans</h1>
        <p className="text-sm text-neutral-600">
          Pick two scans from the history page to compare them side by side.
        </p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/ats/history`}>Go to history</Link>
        </Button>
      </div>
    );
  }

  let result;
  try {
    result = await compareAtsResultsAction(a, b);
  } catch (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Compare scans</h1>
        <p className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          {error instanceof Error ? error.message : "Could not load comparison"}
        </p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/ats/history`}>Back to history</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Compare scans</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Side-by-side view of two analyses with score deltas and keyword gain/loss.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/${locale}/ats/history`}>Back to history</Link>
        </Button>
      </div>

      <ComparePanel result={result} />
    </div>
  );
}
