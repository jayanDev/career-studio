import { BlogPostStatus } from "@prisma/client";

import { slugifyCommunityTitle } from "@/lib/community";
import { findBlogPost } from "@/lib/public-content";
import { prisma } from "@/lib/prisma";

export async function ensureBlogPostRecord(slug: string) {
  const existing = await prisma.blogPost.findUnique({
    where: { slug },
  });

  if (existing) {
    return existing;
  }

  const staticPost = findBlogPost(slug);

  if (!staticPost) {
    return null;
  }

  const category = await prisma.blogCategory.upsert({
    where: { slug: slugifyCommunityTitle(staticPost.category) },
    create: {
      name: staticPost.category,
      slug: slugifyCommunityTitle(staticPost.category),
      description: `${staticPost.category} articles`,
    },
    update: {},
  });

  return prisma.blogPost.create({
    data: {
      title: staticPost.title,
      slug: staticPost.slug,
      authorName: staticPost.author,
      excerpt: staticPost.excerpt,
      content: staticPost.sections.map((section) => `## ${section.heading}\n\n${section.body}`).join("\n\n"),
      categoryId: category.id,
      tags: staticPost.tags.join(", "),
      status: BlogPostStatus.published,
      isFeatured: Boolean(staticPost.featured),
      metaTitle: staticPost.title.slice(0, 60),
      metaDescription: staticPost.excerpt.slice(0, 160),
      readingTime: Number.parseInt(staticPost.readingTime, 10) || 5,
      publishedAt: new Date(`${staticPost.date}T00:00:00.000Z`),
    },
  });
}
