import type { Metadata } from "next";
import Link from "next/link";

import { BulkClient } from "@/components/feature/ats/bulk-client";
import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale } from "@/i18n-config";

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: "Bulk ATS Scoring",
  description: "Score multiple CVs against one job description and rank them.",
};

export default async function BulkPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Bulk scoring (recruiter mode)</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Upload up to 25 CVs, paste one JD, get a ranked shortlist. CVs are scored but not saved to the candidate&apos;s history.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/${locale}/ats`}>Back to ATS</Link>
        </Button>
      </div>

      <BulkClient />
    </div>
  );
}
