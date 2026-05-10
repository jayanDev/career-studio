import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnotationType } from "@prisma/client";
import { ArrowLeft, BookOpen, Highlighter, StickyNote } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { findEbook } from "@/lib/ebooks";
import { prisma } from "@/lib/prisma";
import { deleteBookAnnotationAction, saveBookAnnotationAction } from "@/server/actions/resources/resources";

type EbookReaderPageProps = {
  params: Promise<{ locale: string; bookSlug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: EbookReaderPageProps): Promise<Metadata> {
  const { bookSlug } = await params;
  const ebook = findEbook(bookSlug);

  return {
    title: ebook ? `${ebook.title} - Career Studio Ebooks` : "Ebook - Career Studio",
    description: ebook?.summary,
  };
}

export default async function EbookReaderPage({ params }: EbookReaderPageProps) {
  const { locale: rawLocale, bookSlug } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const ebook = findEbook(bookSlug);
  const t = await getTranslations({ locale, namespace: "phase6.ebooks" });
  const session = await auth();

  if (!ebook) {
    notFound();
  }

  const annotations = session?.user?.id
    ? await prisma.bookAnnotation.findMany({
        where: {
          userId: session.user.id,
          bookSlug,
        },
        orderBy: [{ pageIndex: "asc" }, { createdAt: "asc" }],
      })
    : [];
  const saveAction = saveBookAnnotationAction.bind(null, locale, bookSlug);

  return (
    <div className="bg-white">
      <header className="border-b bg-gradient-to-br from-white via-teal-50 to-amber-50">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <Button asChild variant="ghost" className="-ml-3 mb-6">
            <Link href={`/${locale}/resources`}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Link>
          </Button>
          <Badge variant="outline" className="rounded-md border-teal-200 bg-white text-teal-800">{ebook.category}</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl">{ebook.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-neutral-600">{ebook.summary}</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[1fr_360px]">
        <article className="space-y-6">
          {ebook.chapters.map((chapter, index) => (
            <section key={chapter.title} className="rounded-lg border bg-neutral-50 p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-teal-700">
                <BookOpen className="size-4" />
                {t("page")} {index + 1}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">{chapter.title}</h2>
              <p className="mt-4 text-base leading-8 text-neutral-700">{chapter.body}</p>
            </section>
          ))}
        </article>

        <aside className="space-y-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Highlighter className="size-5 text-teal-700" />
                {t("annotations")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {session?.user?.id ? (
                <form action={saveAction} className="space-y-3">
                  <select name="annotationType" defaultValue={AnnotationType.highlight} className="h-9 w-full rounded-md border bg-white px-3 text-sm">
                    <option value={AnnotationType.highlight}>{t("highlight")}</option>
                    <option value={AnnotationType.note}>{t("note")}</option>
                  </select>
                  <Input name="pageIndex" type="number" min="0" defaultValue="0" placeholder={t("pageIndex")} />
                  <Input name="color" defaultValue="#fef08a" placeholder={t("color")} />
                  <Textarea name="selectedText" placeholder={t("selectedText")} required />
                  <Textarea name="noteText" placeholder={t("noteText")} />
                  <Button type="submit" className="w-full bg-teal-700 text-white hover:bg-teal-800">{t("saveAnnotation")}</Button>
                </form>
              ) : (
                <Button asChild className="w-full bg-teal-700 text-white hover:bg-teal-800">
                  <Link href={`/${locale}/auth/sign-in?callbackUrl=/${locale}/resources/ebooks/${bookSlug}`}>{t("signInToAnnotate")}</Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StickyNote className="size-5 text-teal-700" />
                {t("myNotes")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {annotations.map((annotation) => (
                <article key={annotation.id} className="rounded-md border bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="rounded-md">{annotation.annotationType}</Badge>
                    <span className="text-xs text-neutral-500">{t("page")} {annotation.pageIndex + 1}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-neutral-700">{annotation.selectedText}</p>
                  {annotation.noteText ? <p className="mt-2 text-sm leading-6 text-neutral-500">{annotation.noteText}</p> : null}
                  <form action={deleteBookAnnotationAction.bind(null, locale, annotation.id, bookSlug)} className="mt-3">
                    <Button type="submit" size="sm" variant="outline">{t("delete")}</Button>
                  </form>
                </article>
              ))}
              {annotations.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyAnnotations")}</p> : null}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
