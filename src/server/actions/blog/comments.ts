"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { displayName } from "@/lib/community";
import { prisma } from "@/lib/prisma";
import { ensureBlogPostRecord } from "@/server/services/blog/blog-service";
import { authPath, formValue, requireUser } from "@/server/utils/action-helpers";

const commentSchema = z.object({
  slug: z.string().trim().min(1).max(220),
  content: z.string().trim().min(5).max(3000),
});

const likeSchema = z.object({
  slug: z.string().trim().min(1).max(220),
});

export async function submitBlogCommentAction(locale: Locale, slug: string, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = commentSchema.parse({
    slug,
    content: formValue(formData, "content"),
  });
  const post = await ensureBlogPostRecord(parsed.slug);

  if (!post) {
    throw new Error("Blog post not found");
  }

  await prisma.blogComment.create({
    data: {
      postId: post.id,
      authorId: user.id,
      authorName: displayName(user),
      content: parsed.content,
      isApproved: false,
    },
  });

  redirect(authPath(locale, `/blog/${parsed.slug}`, { comment: "pending" }));
}

export async function toggleBlogLikeAction(locale: Locale, slug: string) {
  const user = await requireUser(locale);
  const parsed = likeSchema.parse({ slug });
  const post = await ensureBlogPostRecord(parsed.slug);

  if (!post) {
    throw new Error("Blog post not found");
  }

  const existing = await prisma.blogLike.findUnique({
    where: {
      postId_userId: {
        postId: post.id,
        userId: user.id,
      },
    },
  });

  if (existing) {
    await prisma.$transaction([
      prisma.blogLike.delete({ where: { id: existing.id } }),
      prisma.blogPost.update({
        where: { id: post.id },
        data: { likes: { decrement: 1 } },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.blogLike.create({
        data: {
          postId: post.id,
          userId: user.id,
        },
      }),
      prisma.blogPost.update({
        where: { id: post.id },
        data: { likes: { increment: 1 } },
      }),
    ]);
  }

  redirect(authPath(locale, `/blog/${parsed.slug}`));
}
