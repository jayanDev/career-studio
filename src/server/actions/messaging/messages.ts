"use server";

import { Buffer } from "node:buffer";

import { MessageAttachmentKind, NotificationType } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { Locale } from "@/i18n-config";
import { directConversationKey, displayName } from "@/lib/community";
import { prisma } from "@/lib/prisma";
import { assertFileSize, detectFileMime, messageMimeTypes } from "@/lib/validators";
import { createNotification } from "@/server/services/notifications/notification-service";
import { authPath, formValue, requireUser } from "@/server/utils/action-helpers";

const sendMessageSchema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});

const conversationIdSchema = z.string().uuid();

function attachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return MessageAttachmentKind.image;
  }

  if (mimeType === "text/plain") {
    return MessageAttachmentKind.text;
  }

  if (mimeType === "text/csv") {
    return MessageAttachmentKind.csv;
  }

  if (messageMimeTypes.has(mimeType)) {
    return MessageAttachmentKind.document;
  }

  return MessageAttachmentKind.other;
}

async function findOrCreateDirectConversation(currentUserId: string, recipientId: string) {
  const title = directConversationKey(currentUserId, recipientId);
  const existing = await prisma.conversation.findFirst({
    where: { title },
  });

  if (existing) {
    return existing;
  }

  return prisma.conversation.create({
    data: { title },
  });
}

async function assertCanMessage(currentUserId: string, recipientId: string) {
  if (currentUserId === recipientId) {
    throw new Error("Cannot message yourself");
  }

  const [recipient, block, privacy] = await Promise.all([
    prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: currentUserId, blockedId: recipientId },
          { blockerId: recipientId, blockedId: currentUserId },
        ],
      },
    }),
    prisma.userPrivacySettings.findUnique({
      where: { userId: recipientId },
      select: { allowMessages: true },
    }),
  ]);

  if (!recipient || block || privacy?.allowMessages === false) {
    throw new Error("Messaging is not available for this member");
  }
}

export async function sendDirectMessageAction(locale: Locale, formData: FormData) {
  const user = await requireUser(locale);
  const parsed = sendMessageSchema.parse({
    recipientId: formValue(formData, "recipientId"),
    body: formValue(formData, "body"),
  });

  await assertCanMessage(user.id, parsed.recipientId);

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: parsed.recipientId },
      select: { firstName: true, lastName: true, email: true },
    }),
  ]);
  const conversation = await findOrCreateDirectConversation(user.id, parsed.recipientId);
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: user.id,
      body: parsed.body,
    },
  });
  const attachment = formData.get("attachment");

  if (attachment instanceof File && attachment.size > 0) {
    assertFileSize(attachment.size, 10 * 1024 * 1024);

    const buffer = Buffer.from(await attachment.arrayBuffer());
    const detectedMime = await detectFileMime(buffer);
    const mimeType = detectedMime === "application/octet-stream" && attachment.type ? attachment.type : detectedMime;

    if (!messageMimeTypes.has(mimeType)) {
      throw new Error("Unsupported attachment type");
    }

    await prisma.messageAttachment.create({
      data: {
        messageId: message.id,
        filename: attachment.name,
        filePath: `messages/${conversation.id}/${message.id}/${attachment.name}`,
        mimeType,
        fileSize: attachment.size,
        kind: attachmentKind(mimeType),
      },
    });
  }

  await prisma.conversationArchive.deleteMany({
    where: {
      conversationId: conversation.id,
      userId: {
        in: [user.id, parsed.recipientId],
      },
    },
  });

  await createNotification({
    userId: parsed.recipientId,
    type: NotificationType.message,
    title: "New message",
    message: `${displayName(sender ?? { email: user.email })}: ${parsed.body.slice(0, 140)}`,
    actionUrl: `/${locale}/messaging?conversation=${conversation.id}`,
  });

  redirect(authPath(locale, "/messaging", { conversation: conversation.id, to: displayName(recipient ?? {}) }));
}

export async function archiveConversationAction(locale: Locale, conversationId: string) {
  const user = await requireUser(locale);
  const parsedId = conversationIdSchema.parse(conversationId);

  await prisma.conversationArchive.upsert({
    where: {
      conversationId_userId: {
        conversationId: parsedId,
        userId: user.id,
      },
    },
    create: {
      conversationId: parsedId,
      userId: user.id,
    },
    update: {
      archivedAt: new Date(),
    },
  });

  redirect(authPath(locale, "/messaging"));
}

export async function getConversationMessagesAction(locale: Locale, conversationId: string) {
  const user = await requireUser(locale);
  const parsedId = conversationIdSchema.parse(conversationId);

  const conversation = await prisma.conversation.findUnique({
    where: { id: parsedId },
  });

  if (!conversation || !conversation.title.includes(user.id)) {
    throw new Error("Unauthorized");
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: parsedId },
    orderBy: { createdAt: "asc" },
    take: 80,
  });

  const senderIds = Array.from(new Set(messages.map((m) => m.senderId)));
  const [senders, attachments] = await Promise.all([
    senderIds.length
      ? prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [],
    messages.length
      ? prisma.messageAttachment.findMany({
          where: { messageId: { in: messages.map((m) => m.id) } },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  return {
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      isRead: m.isRead,
      createdAt: m.createdAt.toISOString(),
    })),
    senders,
    attachments: attachments.map((a) => ({
      id: a.id,
      messageId: a.messageId,
      filename: a.filename,
      filePath: a.filePath,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      kind: a.kind,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
