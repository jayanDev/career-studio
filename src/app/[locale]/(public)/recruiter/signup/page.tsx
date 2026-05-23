import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, ShieldCheck, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { defaultLocale, isLocale } from "@/i18n-config";

export const metadata: Metadata = {
  title: "Recruiter Signup - Career Studio Talent Pool",
  description: "Create a verified recruiter identity and start sourcing Sri Lankan talent.",
};

export default async function RecruiterSignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (session?.user?.id) {
    redirect(`/${locale}/talent-pool/company`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-800">
          <Briefcase className="size-8" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">Hire from Sri Lanka's career-ready talent pool</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-600">
            Create a recruiter identity, verify your company domain, search candidate profiles, save projects, and send privacy-safe outreach.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Verified access", ShieldCheck, "Outreach unlocks after company-domain verification."],
            ["Filter-first search", Search, "Search by role, skill, district, university, notice period, and salary."],
            ["Pipelines", Briefcase, "Organise candidates into sourcing projects and export CSVs."],
          ].map(([title, Icon, body]) => (
            <Card key={title as string} className="bg-white text-left">
              <CardContent className="p-5">
                <Icon className="size-5 text-teal-700" />
                <h2 className="mt-3 text-sm font-semibold text-slate-950">{title as string}</h2>
                <p className="mt-2 text-xs leading-5 text-slate-600">{body as string}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button asChild size="lg" className="bg-teal-700 text-white hover:bg-teal-800">
          <Link href={`/${locale}/auth/sign-in?callbackUrl=/${locale}/talent-pool/company`}>Sign in to create recruiter profile</Link>
        </Button>
      </div>
    </main>
  );
}
