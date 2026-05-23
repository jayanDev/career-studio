import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { GcvEditorClient } from "@/components/feature/gcv/gcv-editor-client";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { parseGcvTheme } from "@/lib/gcv-design";
import { prisma } from "@/lib/prisma";
import { parseResumeContent } from "@/lib/resume-content";

type GcvEditorPageProps = {
  params: Promise<{ locale: string; resumeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: GcvEditorPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.gcvEditor" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function GcvEditorPage({ params, searchParams }: GcvEditorPageProps) {
  const { locale: rawLocale, resumeId } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "phase3.gcvEditor" });
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const [resume, talentProfile] = await Promise.all([
    prisma.gCVResume.findFirst({
      where: { id: resumeId, userId: session.user.id },
    }),
    prisma.talentProfile.findUnique({
      where: { userId: session.user.id },
      select: { customSlug: true },
    }),
  ]);

  if (!resume) {
    notFound();
  }

  const talentSlug = talentProfile?.customSlug || session.user.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{resume.title}</h1>
        <p className="mt-2 text-sm text-neutral-600">{query.saved ? t("saved") : t("subtitle")}</p>
      </div>
      <GcvEditorClient
        locale={locale}
        resumeId={resume.id}
        title={resume.title}
        talentSlug={talentSlug}
        initialContent={parseResumeContent(resume.contentJson)}
        initialTheme={parseGcvTheme(resume.themeJson)}
        labels={{
          title: t("titleLabel"),
          accent: t("accent"),
          density: t("density"),
          template: t("template"),
          summary: t("summary"),
          skills: t("skills"),
          save: t("save"),
          preview: t("preview"),
        }}
      />
    </div>
  );
}
