import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ResumeEditorClient } from "@/components/feature/resumes/resume-editor-client";
import { Button } from "@/components/ui/button";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { getResumeForUser } from "@/server/services/resumes/resume-service";

type ResumeEditorPageProps = {
  params: Promise<{ locale: string; resumeId: string }>;
};

export async function generateMetadata({ params }: ResumeEditorPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.resumeEditor" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ResumeEditorPage({ params }: ResumeEditorPageProps) {
  const { locale: rawLocale, resumeId } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.resumeEditor" });
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const resume = await getResumeForUser(session.user.id, resumeId);
  if (!resume) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{resume.title}</h1>
          <p className="mt-2 text-sm text-neutral-600">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/api/resumes/${resume.id}/export/pdf`}>
              <Download className="size-4" />
              PDF
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/api/resumes/${resume.id}/export/docx`}>
              <Download className="size-4" />
              DOCX
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/api/resumes/${resume.id}/export/bundle`}>
              <Download className="size-4" />
              Bundle
            </Link>
          </Button>
        </div>
      </div>
      <ResumeEditorClient
        resumeId={resume.id}
        initialContent={resume.parsedContent}
        labels={{
          saveIdle: t("saveIdle"),
          saving: t("saving"),
          saved: t("saved"),
          improve: t("improve"),
          add: t("add"),
          remove: t("remove"),
          livePreview: t("livePreview"),
          sections: {
            header: t("sections.header"),
            summary: t("sections.summary"),
            experience: t("sections.experience"),
            education: t("sections.education"),
            skills: t("sections.skills"),
            projects: t("sections.projects"),
            certifications: t("sections.certifications"),
            languages: "Languages",
            awards: "Awards",
            volunteering: "Volunteering",
            publications: "Publications",
            references: "References",
          },
        }}
      />
    </div>
  );
}
