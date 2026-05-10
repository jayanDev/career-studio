"use server";

import { AnnotationType } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { findEbook } from "@/lib/ebooks";
import { prisma } from "@/lib/prisma";
import { authPath, formValue, requireUser } from "@/server/utils/action-helpers";

const resourceIdSchema = z.string().uuid();

const annotationSchema = z.object({
  bookSlug: z.string().trim().min(1).max(220),
  annotationType: z.enum([AnnotationType.highlight, AnnotationType.note]),
  selectedText: z.string().trim().min(1).max(2000),
  noteText: z.string().trim().max(2000).default(""),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#fef08a"),
  pageIndex: z.coerce.number().int().min(0).max(500).default(0),
});

export async function toggleSavedResourceAction(locale: Locale, resourceId: string) {
  const user = await requireUser(locale);
  const parsedId = resourceIdSchema.parse(resourceId);
  const existing = await prisma.savedResource.findUnique({
    where: {
      userId_resourceId: {
        userId: user.id,
        resourceId: parsedId,
      },
    },
  });

  if (existing) {
    await prisma.savedResource.delete({ where: { id: existing.id } });
  } else {
    await prisma.savedResource.create({
      data: {
        userId: user.id,
        resourceId: parsedId,
      },
    });
  }

  redirect(authPath(locale, "/resources"));
}

export async function trackResourceDownloadAction(locale: Locale, resourceId: string) {
  const user = await requireUser(locale);
  const parsedId = resourceIdSchema.parse(resourceId);
  const resource = await prisma.resource.findUnique({
    where: { id: parsedId },
    select: { fileUrl: true },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  await prisma.$transaction([
    prisma.resourceDownload.create({
      data: {
        userId: user.id,
        resourceId: parsedId,
      },
    }),
    prisma.resource.update({
      where: { id: parsedId },
      data: { downloadCount: { increment: 1 } },
    }),
  ]);

  redirect(resource.fileUrl || authPath(locale, "/resources"));
}

export async function saveBookAnnotationAction(locale: Locale, bookSlug: string, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = annotationSchema.parse({
    bookSlug,
    annotationType: formValue(formData, "annotationType") || AnnotationType.highlight,
    selectedText: formValue(formData, "selectedText"),
    noteText: formValue(formData, "noteText"),
    color: formValue(formData, "color") || "#fef08a",
    pageIndex: formValue(formData, "pageIndex") || 0,
  });

  if (!findEbook(parsed.bookSlug)) {
    throw new Error("Ebook not found");
  }

  await prisma.bookAnnotation.create({
    data: {
      userId: user.id,
      bookSlug: parsed.bookSlug,
      annotationType: parsed.annotationType,
      selectedText: parsed.selectedText,
      noteText: parsed.noteText,
      color: parsed.color,
      pageIndex: parsed.pageIndex,
    },
  });

  redirect(authPath(locale, `/resources/ebooks/${parsed.bookSlug}`));
}

export async function deleteBookAnnotationAction(locale: Locale, annotationId: string, bookSlug: string) {
  const user = await requireUser(locale);
  const parsedId = resourceIdSchema.parse(annotationId);

  await prisma.bookAnnotation.deleteMany({
    where: {
      id: parsedId,
      userId: user.id,
      bookSlug,
    },
  });

  redirect(authPath(locale, `/resources/ebooks/${bookSlug}`));
}
