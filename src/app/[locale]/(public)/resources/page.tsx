import type { Metadata } from "next";
import Link from "next/link";
import { ResourceType } from "@prisma/client";
import { ArrowRight, BookOpen, Download, FileText, LockKeyhole, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { ebookCatalog } from "@/lib/ebooks";
import { planRank } from "@/lib/plans";
import { resourceCards, resourceCollections } from "@/lib/public-content";
import { prisma } from "@/lib/prisma";
import { toggleSavedResourceAction, trackResourceDownloadAction } from "@/server/actions/resources/resources";

type ResourcesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const resourceIcons = [FileText, Download, BookOpen, LockKeyhole] as const;

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export async function generateMetadata({ params }: ResourcesPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase1.meta.resources" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ResourcesPage({ params, searchParams }: ResourcesPageProps) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase1.resources" });
  const t6 = await getTranslations({ locale, namespace: "phase6.resources" });
  const session = await auth();
  const q = firstParam(query.q);
  const type = firstParam(query.type);
  const category = firstParam(query.category);
  let categories: { id: string; name: string }[] = [];
  let resources: {
    id: string;
    title: string;
    slug: string;
    type: ResourceType;
    description: string;
    fileUrl: string;
    isPremium: boolean;
    downloadCount: number;
  }[] = [];
  let saved: { resourceId: string }[] = [];

  try {
    [categories, resources, saved] = await Promise.all([
      prisma.resourceCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      prisma.resource.findMany({
        where: {
          isPublished: true,
          ...(type && Object.values(ResourceType).includes(type as ResourceType) ? { type: type as ResourceType } : {}),
          ...(category ? { categoryId: category } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { content: { contains: q, mode: "insensitive" } },
                  { tags: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 24,
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          description: true,
          fileUrl: true,
          isPremium: true,
          downloadCount: true,
        },
      }),
      session?.user?.id
        ? prisma.savedResource.findMany({
            where: { userId: session.user.id },
            select: { resourceId: true },
          })
        : [],
    ]);
  } catch {
    categories = [];
    resources = [];
    saved = [];
  }
  const savedIds = new Set(saved.map((item) => item.resourceId));
  const canAccessPremium = planRank[session?.user?.planTier ?? "basic"] >= planRank.pro;

  return (
    <div className="bg-white">
      <section className="border-b bg-gradient-to-br from-amber-50 via-white to-teal-50">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <SectionHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10">
        <form className="rounded-xl border bg-neutral-50 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div>
              <Label htmlFor="q">{t6("searchLabel")}</Label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <Input id="q" name="q" defaultValue={q} className="pl-9" />
              </div>
            </div>
            <div>
              <Label htmlFor="category">{t6("category")}</Label>
              <select id="category" name="category" defaultValue={category} className="mt-2 h-9 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">{t6("allCategories")}</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="type">{t6("type")}</Label>
              <select id="type" name="type" defaultValue={type} className="mt-2 h-9 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">{t6("allTypes")}</option>
                {Object.values(ResourceType).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full bg-teal-700 text-white hover:bg-teal-800">{t6("filter")}</Button>
            </div>
          </div>
        </form>

        {resources.length > 0 ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {resources.map((resource) => {
              const locked = resource.isPremium && !canAccessPremium;

              return (
                <Card key={resource.id} className="bg-white">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="outline" className="rounded-md">{resource.type}</Badge>
                      {resource.isPremium ? <Badge className="rounded-md bg-amber-600">{t6("premium")}</Badge> : null}
                    </div>
                    <CardTitle>{resource.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-neutral-600">{resource.description}</p>
                    <p className="mt-4 text-sm text-neutral-500">{resource.downloadCount} {t6("downloads")}</p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2 bg-neutral-50">
                    <Button asChild variant="outline">
                      <Link href={`/${locale}/resources/${resource.slug}`}>{t6("open")}</Link>
                    </Button>
                    {session?.user?.id ? (
                      <form action={toggleSavedResourceAction.bind(null, locale, resource.id)}>
                        <Button type="submit" variant="outline">{savedIds.has(resource.id) ? t6("saved") : t6("save")}</Button>
                      </form>
                    ) : null}
                    {resource.fileUrl && !locked ? (
                      <form action={trackResourceDownloadAction.bind(null, locale, resource.id)}>
                        <Button type="submit" variant="outline">{t6("download")}</Button>
                      </form>
                    ) : null}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {resourceCards.map((resource, index) => {
              const Icon = resourceIcons[index];

              return (
                <Card key={resource.title} className={resource.disabled ? "bg-neutral-50 opacity-80" : "bg-white"}>
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-md bg-amber-100 text-amber-900">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{resource.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-neutral-600">{resource.description}</p>
                    <p className="mt-4 text-sm font-semibold text-neutral-950">{resource.count}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-14">
          <SectionHeading eyebrow={t6("ebookEyebrow")} title={t6("ebookTitle")} description={t6("ebookDescription")} />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {ebookCatalog.map((ebook) => (
              <Card key={ebook.slug} className="bg-white">
                <CardHeader>
                  <BookOpen className="size-6 text-teal-700" />
                  <CardTitle>{ebook.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-neutral-600">{ebook.summary}</CardContent>
                <CardFooter className="bg-neutral-50">
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/${locale}/resources/ebooks/${ebook.slug}`}>
                      {t6("readEbook")}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <SectionHeading eyebrow={t("collectionsEyebrow")} title={t("collectionsTitle")} />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {resourceCollections.map((collection) => (
            <Card key={collection.title} className="bg-white">
              <CardHeader>
                <BookOpen className="size-6 text-teal-700" />
                <CardTitle>{collection.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-6 text-neutral-600">{collection.description}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
