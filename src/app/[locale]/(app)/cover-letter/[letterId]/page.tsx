import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CoverLetterEditorClient } from "@/components/feature/cover-letter/cover-letter-editor-client";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCoverLetterContent } from "@/lib/resume-content";

type CoverLetterEditorProps = {
  params: Promise<{ locale: string; letterId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CoverLetterEditorProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.coverLetterEditor" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function CoverLetterEditorPage({ params, searchParams }: CoverLetterEditorProps) {
  const { locale: rawLocale, letterId } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const query = await searchParams;
  await getTranslations({ locale, namespace: "phase3.coverLetterEditor" });
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const letter = await prisma.coverLetter.findFirst({
    where: { id: letterId, userId: session.user.id },
  });

  if (!letter) {
    notFound();
  }

  const content = parseCoverLetterContent(letter.content);
  const versionCount = await prisma.coverLetterVersion.count({ where: { coverLetterId: letter.id } });

  return (
    <CoverLetterEditorClient
      locale={locale}
      letter={{
        id: letter.id,
        title: letter.title,
        jobTitle: letter.jobTitle,
        companyName: letter.companyName,
        jobDescription: letter.jobDescription,
        tone: letter.tone,
      }}
      initialContent={content}
      saved={Boolean(query.saved)}
      versionCount={versionCount}
    />
  );
}
