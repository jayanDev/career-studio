import type { Metadata } from "next";
import { FeedbackStatus } from "@prisma/client";
import { Flag, MessageSquareWarning, ShieldCheck, Users, ShieldAlert } from "lucide-react";
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
  verifyTalentProfileAction,
  verifyRecruiterProfileAction,
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

  const [comments, feedback, flags, unverifiedTalents, unverifiedRecruiters] = await Promise.all([
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
    prisma.talentProfile.findMany({
      where: { isVerified: false },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.recruiterProfile.findMany({
      where: { isVerified: false },
      include: { user: true },
      orderBy: { createdAt: "desc" },
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <QueueStat icon={MessageSquareWarning} label={t("pendingComments")} value={comments.length} />
        <QueueStat icon={ShieldCheck} label={t("openFeedback")} value={feedback.length} />
        <QueueStat icon={Flag} label={t("forumFlags")} value={flags.length} />
        <QueueStat icon={Users} label={t("talentQueue")} value={unverifiedTalents.length} />
        <QueueStat icon={ShieldAlert} label={t("recruiterQueue")} value={unverifiedRecruiters.length} />
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

        <Card className="bg-white xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("talentQueue")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {unverifiedTalents.map((talent) => (
              <article key={talent.id} className="rounded-md border bg-neutral-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-950">
                      {talent.user.firstName} {talent.user.lastName}
                    </span>
                    <span className="text-xs text-neutral-500">@{talent.user.username || "anonymous"}</span>
                  </div>
                  {talent.headline && (
                    <p className="text-xs text-teal-800 font-medium mt-1">{talent.headline}</p>
                  )}
                  <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
                    {talent.bio || "No biography provided."}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {talent.city ? `${talent.city}, ${talent.country}` : talent.country || "No location"}
                  </p>
                </div>
                <form action={verifyTalentProfileAction.bind(null, locale, talent.id, true)} className="mt-4 flex gap-2">
                  <input
                    name="badge"
                    type="text"
                    placeholder={t("badge")}
                    className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs placeholder:text-neutral-400 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                  />
                  <Button type="submit" size="sm" className="bg-teal-700 text-white hover:bg-teal-800">
                    {t("verify")}
                  </Button>
                </form>
              </article>
            ))}
            {unverifiedTalents.length === 0 ? <p className="text-sm text-neutral-500 col-span-2">{t("emptyTalent")}</p> : null}
          </CardContent>
        </Card>

        <Card className="bg-white xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("recruiterQueue")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {unverifiedRecruiters.map((recruiter) => (
              <article key={recruiter.id} className="rounded-md border bg-neutral-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-neutral-950">{recruiter.companyName}</span>
                    {recruiter.industry && <Badge variant="outline">{recruiter.industry}</Badge>}
                  </div>
                  <p className="text-xs text-neutral-600 mt-1">
                    {recruiter.user.email}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {recruiter.location || "No location provided."}
                  </p>
                  <p className="text-xs text-neutral-600 mt-2 line-clamp-2">
                    {recruiter.about || "No description provided."}
                  </p>
                </div>
                <form action={verifyRecruiterProfileAction.bind(null, locale, recruiter.id, true)} className="mt-4 flex gap-2">
                  <select
                    name="accessLevel"
                    className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
                    defaultValue="verified"
                  >
                    <option value="guest">Guest</option>
                    <option value="verified">Verified</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                  <Button type="submit" size="sm" className="bg-teal-700 text-white hover:bg-teal-800">
                    {t("verify")}
                  </Button>
                </form>
              </article>
            ))}
            {unverifiedRecruiters.length === 0 ? <p className="text-sm text-neutral-500 col-span-2">{t("emptyRecruiter")}</p> : null}
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
