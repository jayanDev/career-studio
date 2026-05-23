import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Languages, Palette, SlidersHorizontal, WandSparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { coverLetterTemplateGallery, coverLetterTonePreviews } from "@/lib/cover-letter-optimization";
import { prisma } from "@/lib/prisma";
import { parseCoverLetterContent } from "@/lib/resume-content";
import { generateCoverLetterAction } from "@/server/actions/resumes/create-resume";

type CoverLetterPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: CoverLetterPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.meta.coverLetter" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function CoverLetterPage({ params }: CoverLetterPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase3.coverLetter" });
  const session = await auth();
  const action = generateCoverLetterAction.bind(null, locale);
  const letters = session?.user?.id
    ? await prisma.coverLetter.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 12,
      })
    : [];
  const resumes = session?.user?.id
    ? await prisma.resume.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, templateKey: true },
        take: 20,
      })
    : [];
  const applications = session?.user?.id
    ? await prisma.jobApplication.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, jobTitle: true, companyName: true },
        take: 20,
      })
    : [];
  const parsedLetters = letters.map((letter) => ({ letter, content: parseCoverLetterContent(letter.content) }));
  const averageScore = parsedLetters.length
    ? Math.round(parsedLetters.reduce((sum, item) => sum + (item.content.qualityScore || 0), 0) / parsedLetters.length)
    : 0;
  const responseTracked = parsedLetters.filter((item) => item.content.performance.replyReceived).length;
  const quantifiedWins = parsedLetters.filter((item) => /\b\d+[%x]?\b|rs\.?|lkr|usd|million|revenue|reduced|increased|improved/i.test(item.content.achievements.join(" "))).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t("wizardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="jobTitle" placeholder={t("jobTitle")} required />
              <Input name="companyName" placeholder={t("companyName")} required />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <div className="rounded-md border border-teal-100 bg-teal-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-teal-950">
                    <WandSparkles className="size-4" />
                    One-click tailored flow
                  </div>
                  <p className="mt-1 text-xs leading-5 text-teal-800">Pick a saved resume, paste a JD or URL, and generate a tailored letter without the long wizard.</p>
                  <select name="resumeId" className="mt-3 h-9 w-full rounded-md border bg-white px-3 text-sm">
                    <option value="">Use manual profile text</option>
                    {resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.title} ({resume.templateKey})
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea name="profileText" rows={6} placeholder={t("profileText")} />
                <Input name="jobUrl" placeholder="LinkedIn/job URL (optional)" />
              </div>
              <Textarea name="jobDescription" rows={11} placeholder={t("jobDescription")} />
            </div>
            <div className="grid gap-3 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-medium text-neutral-600">
                <span className="flex items-center gap-1"><SlidersHorizontal className="size-3.5" /> Length</span>
                <select name="lengthTarget" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="short">Short (180-220 words)</option>
                  <option value="standard">Standard (300-400 words)</option>
                  <option value="long">Long (500-650 words)</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-neutral-600">
                <span className="flex items-center gap-1"><Languages className="size-3.5" /> Language</span>
                <select name="language" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="en">English</option>
                  <option value="si">Sinhala</option>
                  <option value="ta">Tamil</option>
                  <option value="bilingual_si">English + Sinhala</option>
                  <option value="bilingual_ta">English + Tamil</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-neutral-600">
                Mode
                <select name="mode" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="international">International</option>
                  <option value="local">Local SL</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-neutral-600">
                Job Tracker link
                <select name="jobApplicationId" className="h-9 rounded-md border bg-white px-3 text-sm">
                  <option value="">No linked application</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>
                      {application.jobTitle} - {application.companyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-medium text-neutral-900">Referral opener</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input name="referrerName" placeholder="Referrer name" />
                  <Input name="referrerContext" placeholder="worked with me at..." />
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-medium text-neutral-900">Salary expectation (optional)</div>
                <div className="grid gap-2 md:grid-cols-4">
                  <Input name="salaryMinimum" placeholder="Min" />
                  <Input name="salaryMaximum" placeholder="Max" />
                  <select name="salaryCurrency" className="h-9 rounded-md border bg-white px-3 text-sm">
                    <option value="LKR">LKR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                  <select name="salaryPeriod" className="h-9 rounded-md border bg-white px-3 text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-neutral-900">
                  <Palette className="size-4" />
                  Template gallery
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {coverLetterTemplateGallery.map((template) => (
                    <label key={template.key} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs">
                      <input type="radio" name="templateKey" value={template.key} defaultChecked={template.key === "classic"} />
                      <span>
                        <span className="block font-medium text-neutral-900">{template.name}</span>
                        <span className="block text-neutral-500">{template.layout}</span>
                        <span className="mt-1 block">{template.atsSafe ? "ATS-safe" : "Visual - use selectively"}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <input type="hidden" name="accentColor" value="#0f766e" />
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 text-sm font-medium text-neutral-900">Tone preview</div>
                <select name="tone" className="mb-3 h-9 rounded-md border bg-white px-3 text-sm">
                  {["PROFESSIONAL", "CONFIDENT", "WARM", "EXECUTIVE", "CONVERSATIONAL", "ENTHUSIASTIC"].map((tone) => (
                  <option key={tone} value={tone}>
                    {tone}
                  </option>
                ))}
                </select>
                <div className="grid gap-2">
                  {Object.entries(coverLetterTonePreviews).slice(0, 4).map(([tone, preview]) => (
                    <p key={tone} className="rounded-md bg-neutral-50 p-2 text-xs leading-5 text-neutral-600">
                      <span className="font-medium text-neutral-900">{tone}:</span> {preview}
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                <WandSparkles className="size-4" />
                {t("generate")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Average quality</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-950">{averageScore}/100</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">Replies tracked</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-950">{responseTracked}</p>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">With metrics</p>
            <p className="mt-2 text-3xl font-semibold text-neutral-950">{quantifiedWins}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {parsedLetters.map(({ letter, content }) => (
          <Card key={letter.id} className="bg-white">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <FileText className="size-6 text-teal-700" />
                <Badge variant="outline" className="rounded-md">
                  {letter.tone}
                </Badge>
              </div>
              <CardTitle>{letter.title}</CardTitle>
              <p className="text-sm text-neutral-600">{letter.companyName}</p>
              <p className="text-xs text-neutral-500">
                {content.qualityScore || 0}/100 - {content.qualityLabel}
              </p>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${locale}/cover-letter/${letter.id}`}>{t("openEditor")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
