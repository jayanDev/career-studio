import type { Metadata } from "next";
import Link from "next/link";

import { MultiJdClient } from "@/components/feature/ats/multi-jd-client";
import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale } from "@/i18n-config";

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = {
  title: "Multi-JD scoring",
  description: "Compare your resume against multiple job descriptions at once.",
};

export default async function MultiJdPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Multi-JD scoring</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Score your resume against up to 6 job descriptions in one pass. See which role you fit best before deciding which one to tailor for.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/${locale}/ats`}>Back to ATS</Link>
        </Button>
      </div>
      <MultiJdClient />
    </div>
  );
}
