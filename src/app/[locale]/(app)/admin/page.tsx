import type { Metadata } from "next";
import { FeedbackStatus } from "@prisma/client";
import { Flag, MessageSquareWarning, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  moderateBlogCommentAction,
  updateFeedbackModerationAction,
  updateForumFlagAction,
} from "@/server/actions/admin/moderation";

type AdminPageProps = {
  params: Promise<{ locale: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: AdminPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase6.meta.admin" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AdminPage({ params }: AdminPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase6.admin" });
  const session = await auth();

  if (!session?.user?.isStaff) {
    redirect(`/${locale}/dashboard`);
  }

  const [comments, feedback, flags] = await Promise.all([
    prisma.blogComment.findMany({
      where: { isApproved: false },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
    prisma.feedback.findMany({
      where: { status: { in: [FeedbackStatus.new, FeedbackStatus.in_review] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.forumFlag.findMany({
      where: { status: "new" },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);
  const postIds = Array.from(new Set(comments.map((comment) => comment.postId)));
  const posts = postIds.length
    ? await prisma.blogPost.findMany({
        where: { id: { in: postIds } },
        select: { id: true, title: true },
      })
    : [];
  const postMap = new Map(posts.map((post) => [post.id, post]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <QueueStat icon={MessageSquareWarning} label={t("pendingComments")} value={comments.length} />
        <QueueStat icon={ShieldCheck} label={t("openFeedback")} value={feedback.length} />
        <QueueStat icon={Flag} label={t("forumFlags")} value={flags.length} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("blogModeration")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.map((comment) => (
              <article key={comment.id} className="rounded-md border bg-neutral-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md">{postMap.get(comment.postId)?.title ?? t("unknownPost")}</Badge>
                  <span className="text-sm font-medium text-neutral-950">{comment.authorName}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{comment.content}</p>
                <div className="mt-3 flex gap-2">
                  <form action={moderateBlogCommentAction.bind(null, locale, comment.id, "approve")}>
                    <Button type="submit" size="sm" className="bg-teal-700 text-white hover:bg-teal-800">{t("approve")}</Button>
                  </form>
                  <form action={moderateBlogCommentAction.bind(null, locale, comment.id, "reject")}>
                    <Button type="submit" size="sm" variant="outline">{t("reject")}</Button>
                  </form>
                </div>
              </article>
            ))}
            {comments.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyComments")}</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>{t("feedbackQueue")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feedback.map((item) => (
              <article key={item.id} className="rounded-md border bg-neutral-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md">{item.type}</Badge>
                  <Badge variant="outline" className="rounded-md">{item.status}</Badge>
                </div>
                <h2 className="mt-3 font-semibold text-neutral-950">{item.title}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{item.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[FeedbackStatus.in_review, FeedbackStatus.planned, FeedbackStatus.completed, FeedbackStatus.wont_fix].map((status) => (
                    <form key={status} action={updateFeedbackModerationAction.bind(null, locale, item.id, status)}>
                      <Button type="submit" size="sm" variant="outline">{status}</Button>
                    </form>
                  ))}
                </div>
              </article>
            ))}
            {feedback.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyFeedback")}</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-white xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("forumFlagsTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {flags.map((flag) => (
              <article key={flag.id} className="rounded-md border bg-neutral-50 p-4">
                <Badge variant="outline" className="rounded-md">{flag.threadId ? t("thread") : t("reply")}</Badge>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{flag.reason}</p>
                <div className="mt-3 flex gap-2">
                  <form action={updateForumFlagAction.bind(null, locale, flag.id, "reviewed")}>
                    <Button type="submit" size="sm" className="bg-teal-700 text-white hover:bg-teal-800">{t("reviewed")}</Button>
                  </form>
                  <form action={updateForumFlagAction.bind(null, locale, flag.id, "dismissed")}>
                    <Button type="submit" size="sm" variant="outline">{t("dismiss")}</Button>
                  </form>
                </div>
              </article>
            ))}
            {flags.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyFlags")}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QueueStat({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: number }) {
  return (
    <Card className="bg-white">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-11 items-center justify-center rounded-md bg-teal-100 text-teal-800">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold text-neutral-950">{value}</div>
          <div className="text-sm text-neutral-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
