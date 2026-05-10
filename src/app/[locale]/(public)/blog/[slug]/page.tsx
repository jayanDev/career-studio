import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Heart, MessageSquare, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { blogPosts, findBlogPost } from "@/lib/public-content";
import { prisma } from "@/lib/prisma";
import { submitBlogCommentAction, toggleBlogLikeAction } from "@/server/actions/blog/comments";

type BlogPostPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const post = findBlogPost(slug);
  const t = await getTranslations({ locale, namespace: "phase1.meta.blogPost" });

  if (!post) {
    return {
      title: t("notFoundTitle"),
    };
  }

  return {
    title: `${post.title} | Career Studio Blog`,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: `https://careerstudio.app/blog/${post.slug}`,
    },
  };
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BlogPostPage({ params, searchParams }: BlogPostPageProps) {
  const { locale: rawLocale, slug } = await params;
  const query = (await searchParams) ?? {};
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const post = findBlogPost(slug);
  const t = await getTranslations({ locale, namespace: "phase1.blogPost" });
  const t6 = await getTranslations({ locale, namespace: "phase6.blog" });
  const session = await auth();

  if (!post) {
    notFound();
  }

  let dbPost: { id: string; likes: number } | null = null;
  let comments: { id: string; authorName: string; content: string }[] = [];
  let userLike: { id: string } | null = null;

  try {
    dbPost = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true, likes: true },
    });

    if (dbPost) {
      const [commentRows, like] = await Promise.all([
        prisma.blogComment.findMany({
          where: {
            postId: dbPost.id,
            isApproved: true,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true, authorName: true, content: true },
        }),
        session?.user?.id
          ? prisma.blogLike.findUnique({
              where: {
                postId_userId: {
                  postId: dbPost.id,
                  userId: session.user.id,
                },
              },
              select: { id: true },
            })
          : null,
      ]);

      comments = commentRows;
      userLike = like;
    }
  } catch {
    dbPost = null;
    comments = [];
    userLike = null;
  }
  const relatedPosts = blogPosts.filter((item) => item.slug !== post.slug && item.category === post.category).slice(0, 2);
  const commentAction = submitBlogCommentAction.bind(null, locale, slug);
  const likeAction = toggleBlogLikeAction.bind(null, locale, slug);
  const pendingComment = firstParam(query.comment) === "pending";

  return (
    <article className="bg-white">
      <header className="border-b bg-gradient-to-br from-white via-teal-50 to-amber-50">
        <div className="mx-auto max-w-4xl px-4 py-14">
          <Button asChild variant="ghost" className="-ml-3 mb-6">
            <Link href={`/${locale}/blog`}>
              <ArrowLeft className="size-4" />
              {t("back")}
            </Link>
          </Button>
          <Badge variant="outline" className="rounded-md border-teal-200 bg-white text-teal-800">
            {post.category}
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-neutral-950 md:text-5xl">{post.title}</h1>
          <p className="mt-5 text-lg leading-8 text-neutral-600">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-neutral-600">
            <span>{post.author}</span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-4" />
              {post.date}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4" />
              {post.readingTime}
            </span>
            <span className="inline-flex items-center gap-2">
              <Heart className="size-4" />
              {dbPost?.likes ?? 0}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_280px]">
        <div className="mx-auto max-w-3xl">
          {post.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{section.heading}</h2>
              <p className="mt-4 text-base leading-8 text-neutral-700">{section.body}</p>
            </section>
          ))}

          <section className="mt-12 border-t pt-8">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-teal-700" />
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">{t6("comments")}</h2>
            </div>
            {pendingComment ? (
              <Badge className="mt-4 rounded-md bg-amber-600">{t6("pendingReview")}</Badge>
            ) : null}
            <div className="mt-5 space-y-4">
              {comments.map((comment) => (
                <article key={comment.id} className="rounded-lg border bg-neutral-50 p-4">
                  <div className="font-medium text-neutral-950">{comment.authorName}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{comment.content}</p>
                </article>
              ))}
              {comments.length === 0 ? <p className="text-sm text-neutral-500">{t6("emptyComments")}</p> : null}
            </div>

            {session?.user?.id ? (
              <div className="mt-6 grid gap-4 rounded-lg border bg-white p-4">
                <form action={likeAction}>
                  <Button type="submit" variant="outline">
                    <Heart className="size-4" />
                    {userLike ? t6("unlike") : t6("like")}
                  </Button>
                </form>
                <form action={commentAction} className="space-y-3">
                  <Textarea name="content" placeholder={t6("commentPlaceholder")} required />
                  <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                    {t6("submitComment")}
                  </Button>
                </form>
              </div>
            ) : (
              <Button asChild className="mt-6 bg-teal-700 text-white hover:bg-teal-800">
                <Link href={`/${locale}/auth/sign-in?callbackUrl=/${locale}/blog/${post.slug}`}>{t6("signInToComment")}</Link>
              </Button>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card className="bg-neutral-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 font-semibold text-neutral-950">
                <Tag className="size-4 text-teal-700" />
                {t("topics")}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-md bg-white">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          {relatedPosts.length > 0 ? (
            <Card className="bg-white">
              <CardContent className="p-5">
                <div className="font-semibold text-neutral-950">{t("related")}</div>
                <div className="mt-4 grid gap-3">
                  {relatedPosts.map((item) => (
                    <Link key={item.slug} href={`/${locale}/blog/${item.slug}`} className="text-sm leading-6 text-teal-800 hover:underline">
                      {item.title}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}
