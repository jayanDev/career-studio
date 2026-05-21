import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ProfileBuilder } from "@/components/talent/ProfileBuilder";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { getOrCreateTalentProfile } from "@/server/actions/talent";

type EditTalentPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return {
    title: "Edit Career Profile - Career Studio",
    description: "Build and design your LinkedIn-style career profile, upload credentials and write details using AI.",
  };
}

export default async function EditTalentPage({ params }: EditTalentPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const profile = await getOrCreateTalentProfile(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/talent`} className="flex items-center gap-1">
            <ArrowLeft className="size-4" />
            <span>Back to Dashboard</span>
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Edit Career Profile</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Build a visually stunning profile to highlight your accomplishments, certifications, and portfolio items.
        </p>
      </div>

      <ProfileBuilder initialProfile={profile} locale={locale} />
    </div>
  );
}
