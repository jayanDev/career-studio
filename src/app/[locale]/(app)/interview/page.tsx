import type { Metadata } from "next";
import { BookOpenCheck, Clock, MessageSquareText, Search } from "lucide-react";
import { Difficulty, InterviewCategory, Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { InterviewPracticeClient } from "@/components/feature/interview/interview-practice-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type InterviewPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const categories = Object.values(InterviewCategory);
const difficulties = Object.values(Difficulty);

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: InterviewPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.meta.interview" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InterviewPage({ params, searchParams }: InterviewPageProps) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase4.interview" });
  const session = await auth();
  const category = single(query.category);
  const difficulty = single(query.difficulty);
  const search = single(query.q) ?? "";
  const where: Prisma.InterviewQuestionWhereInput = {
    isActive: true,
    ...(categories.includes(category as InterviewCategory) ? { category: category as InterviewCategory } : {}),
    ...(difficulties.includes(difficulty as Difficulty) ? { difficulty: difficulty as Difficulty } : {}),
    ...(search
      ? {
          OR: [
            { questionText: { contains: search, mode: "insensitive" } },
            { tags: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [questions, sessions] = session?.user?.id
    ? await Promise.all([
        prisma.interviewQuestion.findMany({
          where,
          orderBy: [{ category: "asc" }, { difficulty: "asc" }],
          take: 50,
        }),
        prisma.practiceSession.findMany({
          where: { userId: session.user.id },
          orderBy: { startedAt: "desc" },
          take: 6,
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <form className="grid gap-3 rounded-lg border bg-white p-4 lg:grid-cols-[1fr_180px_180px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-neutral-400" />
          <Input name="q" defaultValue={search} placeholder={t("searchPlaceholder")} className="pl-9" />
        </div>
        <select name="category" defaultValue={category ?? ""} className="h-9 rounded-md border bg-white px-3 text-sm">
          <option value="">{t("allCategories")}</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select name="difficulty" defaultValue={difficulty ?? ""} className="h-9 rounded-md border bg-white px-3 text-sm">
          <option value="">{t("allDifficulties")}</option>
          {difficulties.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <Button type="submit" variant="outline">{t("filter")}</Button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{t("questionBank")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((question) => (
                <article key={question.id} className="rounded-md border bg-neutral-50 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-md">{question.category}</Badge>
                    <Badge variant="outline" className="rounded-md">{question.difficulty}</Badge>
                    {question.isPremium ? <Badge className="rounded-md bg-amber-600">{t("premium")}</Badge> : null}
                  </div>
                  <h2 className="mt-3 font-semibold text-neutral-950">{question.questionText}</h2>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{question.tips}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-neutral-500">
                    <BookOpenCheck className="size-4" />
                    {question.timesPracticed} {t("practices")}
                  </div>
                </article>
              ))}
              {questions.length === 0 ? <div className="rounded-md border border-dashed p-6 text-center text-sm text-neutral-500">{t("emptyQuestions")}</div> : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <InterviewPracticeClient
            questions={questions.slice(0, 12).map((question) => ({
              id: question.id,
              questionText: question.questionText,
              category: question.category,
            }))}
            labels={{
              practiceTitle: t("practiceTitle"),
              answerPlaceholder: t("answerPlaceholder"),
              getFeedback: t("getFeedback"),
              streamFeedback: t("streamFeedback"),
              score: t("score"),
              strengths: t("strengths"),
              improvements: t("improvements"),
              tips: t("tips"),
              sampleAnswer: t("sampleAnswer"),
            }}
          />

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{t("history")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sessions.map((practice) => (
                <div key={practice.id} className="flex items-center justify-between rounded-md border bg-neutral-50 p-3">
                  <div>
                    <div className="font-medium text-neutral-950">{practice.category || t("mixedPractice")}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                      <Clock className="size-3.5" />
                      {Math.round(practice.timeSpent / 60)} {t("minutes")}
                    </div>
                  </div>
                  <Badge variant="outline" className="rounded-md">
                    <MessageSquareText className="size-3" />
                    {practice.questionsAnswered}/{practice.numQuestions}
                  </Badge>
                </div>
              ))}
              {sessions.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyHistory")}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
