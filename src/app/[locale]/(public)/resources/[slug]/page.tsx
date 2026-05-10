import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, LockKeyhole } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { planRank } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { toggleSavedResourceAction, trackResourceDownloadAction } from "@/server/actions/resources/resources";

type ResourceDetailPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ResourceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = await prisma.resource
    .findUnique({
      where: { slug },
      select: { title: true, description: true },
    })
    .catch(() => null);

  return {
    title: resource ? `${resource.title} - Career Studio Resources` : "Resource - Career Studio",
    description: resource?.description,
  };
}

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase6.resources" });
  const session = await auth();
  const resource = await prisma.resource
    .findFirst({
      where: {
        slug,
        isPublished: true,
      },
    })
    .catch(() => null);

  if (!resource) {
    notFound();
  }

  const [category, saved] = await Promise.all([
    resource.categoryId ? prisma.resourceCategory.findUnique({ where: { id: resource.categoryId } }) : null,
    session?.user?.id
      ? prisma.savedResource.findUnique({
          where: {
            userId_resourceId: {
              userId: session.user.id,
              resourceId: resource.id,
            },
          },
        })
      : null,
  ]);
  const canAccessPremium = planRank[session?.user?.planTier ?? "basic"] >= planRank.pro;
  const locked = resource.isPremium && !canAccessPremium;

  return (
    <article className="bg-white">
      <header className="border-b bg-gradient-to-br from-white via-amber-50 to-teal-50">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <Button asChild variant="ghost" className="-ml-3 mb-6">
            <Link href={`/${locale}/resources`}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-md">{resource.type}</Badge>
            {category ? <Badge variant="outline" className="rounded-md">{category.name}</Badge> : null}
            {resource.isPremium ? <Badge className="rounded-md bg-amber-600">{t("premium")}</Badge> : null}
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl">{resource.title}</h1>
          <p className="mt-5 text-lg leading-8 text-neutral-600">{resource.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {session?.user?.id ? (
              <form action={toggleSavedResourceAction.bind(null, locale, resource.id)}>
                <Button type="submit" variant="outline">{saved ? t("saved") : t("save")}</Button>
              </form>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/${locale}/auth/sign-in?callbackUrl=/${locale}/resources/${resource.slug}`}>{t("signInToSave")}</Link>
              </Button>
            )}
            {resource.fileUrl && !locked ? (
              <form action={trackResourceDownloadAction.bind(null, locale, resource.id)}>
                <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                  <Download className="size-4" />
                  {t("download")}
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12">
        {locked ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-4 p-6">
              <LockKeyhole className="mt-1 size-5 text-amber-700" />
              <div>
                <h2 className="font-semibold text-neutral-950">{t("premiumRequired")}</h2>
                <p className="mt-2 text-sm leading-6 text-neutral-700">{t("premiumRequiredBody")}</p>
                <Button asChild className="mt-4 bg-teal-700 text-white hover:bg-teal-800">
                  <Link href={`/${locale}/billing?upgrade=pro&from=/${locale}/resources/${resource.slug}`}>{t("upgrade")}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 text-base leading-8 text-neutral-700">
            {resource.content.split("\n\n").filter(Boolean).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
