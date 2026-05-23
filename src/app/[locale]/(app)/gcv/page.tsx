import type { Metadata } from "next";
import Link from "next/link";
import { LayoutTemplate, Palette } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { gcvPalettes, gcvTemplates } from "@/lib/gcv-design";
import { prisma } from "@/lib/prisma";
import { createGcvResumeAction } from "@/server/actions/resumes/create-resume";

type GcvPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: GcvPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.gcv" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function GcvPage({ params }: GcvPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.gcv" });
  const session = await auth();
  const action = createGcvResumeAction.bind(null, locale);
  const resumes = session?.user?.id
    ? await prisma.gCVResume.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t("createTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <Input name="title" placeholder={t("titlePlaceholder")} required />
            <div className="grid gap-3 md:grid-cols-4">
              <select name="palette" className="h-9 rounded-md border bg-white px-3 text-sm">
                {gcvPalettes.map((palette) => (
                  <option key={palette.key} value={palette.key}>{palette.name}</option>
                ))}
              </select>
              <select name="density" className="h-9 rounded-md border bg-white px-3 text-sm">
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
                <option value="spacious">Spacious</option>
              </select>
              <select name="mode" className="h-9 rounded-md border bg-white px-3 text-sm">
                <option value="visual">Visual</option>
                <option value="ats-safe">ATS-safe</option>
              </select>
              <select name="paper" className="h-9 rounded-md border bg-white px-3 text-sm">
                <option value="A4">Local SL / A4</option>
                <option value="Letter">International / Letter</option>
              </select>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-900">
                <LayoutTemplate className="size-4 text-teal-700" />
                Template gallery
              </div>
              <div className="grid max-h-96 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-3">
                {gcvTemplates.map((template) => (
                  <label key={template.key} className="cursor-pointer rounded-md border p-3 text-sm hover:bg-neutral-50">
                    <input type="radio" name="template" value={template.key} defaultChecked={template.key === "tech-minimal-stack"} className="mr-2" />
                    <span className="font-medium text-neutral-950">{template.name}</span>
                    <span className="mt-1 block text-xs leading-5 text-neutral-500">
                      {template.industry} | {template.layout} | {template.tone}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" name="showPhoto" defaultChecked /> Photo</label>
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" name="showLogos" defaultChecked /> SL logos</label>
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" name="showQr" defaultChecked /> QR</label>
              <label className="flex items-center gap-2 text-sm text-neutral-700"><input type="checkbox" name="showMotif" /> SL motif</label>
              <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                <Palette className="size-4" />
                {t("create")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {resumes.map((resume) => (
          <Card key={resume.id} className="bg-white">
            <CardHeader>
              <Palette className="size-6 text-teal-700" />
              <CardTitle>{resume.title}</CardTitle>
              <p className="text-sm text-neutral-600">{resume.updatedAt.toLocaleDateString("en-LK")}</p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/gcv/${resume.id}`}>{t("openEditor")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
