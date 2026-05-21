import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { CompanyProfileForm } from "@/components/recruiter/CompanyProfileForm";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CompanyProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return {
    title: "Recruiter Company Profile - Career Studio",
    description: "Manage your recruiter identity and company profile details to reach candidates.",
  };
}

export default async function CompanyProfilePage({ params }: CompanyProfilePageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  // Load recruiter profile
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-3 mt-4">
        <Button asChild variant="ghost" size="sm" className="text-neutral-500 hover:text-neutral-900 transition-colors">
          <Link href={`/${locale}/talent-pool`} className="flex items-center gap-2">
            <ArrowLeft className="size-4" />
            <span className="font-medium">Back to Candidates</span>
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-neutral-950 to-neutral-600">
          Recruiter Identity & Setup
        </h1>
        <p className="text-lg text-neutral-500 max-w-2xl leading-relaxed">
          Configure your organization profile to establish trust. A verified identity significantly increases candidate response rates when initiating connections.
        </p>
      </div>

      <CompanyProfileForm initialProfile={profile} locale={locale} />
    </div>
  );
}
