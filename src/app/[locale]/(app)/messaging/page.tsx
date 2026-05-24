import type { Metadata } from "next";
import { Archive, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { displayName, otherDirectParticipant } from "@/lib/community";
import { prisma } from "@/lib/prisma";
import { archiveConversationAction, sendDirectMessageAction } from "@/server/actions/messaging/messages";
import { ChatClient } from "@/components/feature/messaging/chat-client";

type MessagingPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: MessagingPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase5.meta.messaging" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function MessagingPage({ params, searchParams }: MessagingPageProps) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase5.messaging" });
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";
  const selectedConversationId = single(query.conversation);
  const q = single(query.q) ?? "";
  const sendAction = sendDirectMessageAction.bind(null, locale);

  const [conversations, archived, candidates] = currentUserId
    ? await Promise.all([
        prisma.conversation.findMany({
          where: { title: { contains: currentUserId } },
          orderBy: { updatedAt: "desc" },
          take: 30,
        }),
        prisma.conversationArchive.findMany({
          where: { userId: currentUserId },
          select: { conversationId: true },
        }),
        prisma.user.findMany({
          where: {
            id: { not: currentUserId },
            isActive: true,
            ...(q
              ? {
                  OR: [
                    { firstName: { contains: q, mode: "insensitive" } },
                    { lastName: { contains: q, mode: "insensitive" } },
                    { email: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: [{ firstName: "asc" }, { email: "asc" }],
          take: 12,
        }),
      ])
    : [[], [], []];

  const archivedIds = new Set(archived.map((item) => item.conversationId));
  const visibleConversations = conversations.filter((conversation) => !archivedIds.has(conversation.id));
  const activeConversation = visibleConversations.find((conversation) => conversation.id === selectedConversationId) ?? visibleConversations[0] ?? null;
  const partnerIds = visibleConversations
    .map((conversation) => otherDirectParticipant(conversation.title, currentUserId))
    .filter((value): value is string => Boolean(value));
  const activePartnerId = activeConversation ? otherDirectParticipant(activeConversation.title, currentUserId) : null;
  const [partners, messages] = await Promise.all([
    partnerIds.length
      ? prisma.user.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, firstName: true, lastName: true, email: true, image: true },
        })
      : [],
    activeConversation
      ? prisma.message.findMany({
          where: { conversationId: activeConversation.id },
          orderBy: { createdAt: "asc" },
          take: 80,
        })
      : [],
  ]);
  const partnerMap = new Map(partners.map((partner) => [partner.id, partner]));
  const senderIds = Array.from(new Set(messages.map((message) => message.senderId)));
  const [senders, attachments] = await Promise.all([
    senderIds.length
      ? prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [],
    messages.length
      ? prisma.messageAttachment.findMany({
          where: { messageId: { in: messages.map((message) => message.id) } },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);
  // senders + attachments fetched above are reserved for the chat panel
  // (passed down via getMessages elsewhere); the parent server component
  // doesn't currently render them, so we don't materialise the maps here.
  void senders;
  void attachments;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{t("conversations")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleConversations.map((conversation) => {
                const partnerId = otherDirectParticipant(conversation.title, currentUserId);
                const partner = partnerId ? partnerMap.get(partnerId) : null;
                const isActive = activeConversation?.id === conversation.id;

                return (
                  <a
                    key={conversation.id}
                    href={`/${locale}/messaging?conversation=${conversation.id}`}
                    className={`block rounded-md border p-3 text-sm transition ${isActive ? "border-teal-600 bg-teal-50" : "bg-neutral-50 hover:bg-neutral-100"}`}
                  >
                    <div className="font-medium text-neutral-950">{displayName(partner ?? {})}</div>
                    <div className="mt-1 text-xs text-neutral-500">{conversation.updatedAt.toLocaleDateString("en-LK")}</div>
                  </a>
                );
              })}
              {visibleConversations.length === 0 ? <p className="text-sm text-neutral-500">{t("emptyConversations")}</p> : null}
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>{t("startConversation")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form className="flex gap-2">
                <Input name="q" defaultValue={q} placeholder={t("searchMembers")} />
                <Button type="submit" variant="outline">{t("search")}</Button>
              </form>
              {candidates.map((candidate) => (
                <form key={candidate.id} action={sendAction} className="rounded-md border bg-neutral-50 p-3">
                  <input type="hidden" name="recipientId" value={candidate.id} />
                  <div className="font-medium text-neutral-950">{displayName(candidate)}</div>
                  <Textarea name="body" className="mt-3" placeholder={t("messagePlaceholder")} required />
                  <Button type="submit" size="sm" className="mt-3 bg-teal-700 text-white hover:bg-teal-800">
                    <Send className="size-4" />
                    {t("send")}
                  </Button>
                </form>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>{activePartnerId ? displayName(partnerMap.get(activePartnerId) ?? {}) : t("conversation")}</CardTitle>
              <p className="mt-1 text-sm text-neutral-500">{t("realtimeNote")}</p>
            </div>
            {activeConversation ? (
              <form action={archiveConversationAction.bind(null, locale, activeConversation.id)}>
                <Button type="submit" variant="outline" size="sm">
                  <Archive className="size-4" />
                  {t("archive")}
                </Button>
              </form>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <ChatClient
              initialMessages={messages.map((m) => ({
                id: m.id,
                conversationId: m.conversationId,
                senderId: m.senderId,
                body: m.body,
                isRead: m.isRead,
                createdAt: m.createdAt.toISOString(),
              }))}
              initialSenders={senders}
              initialAttachments={attachments.map((a) => ({
                id: a.id,
                messageId: a.messageId,
                filename: a.filename,
                filePath: a.filePath,
                mimeType: a.mimeType,
                fileSize: a.fileSize,
                kind: a.kind,
                createdAt: a.createdAt.toISOString(),
              }))}
              currentUserId={currentUserId}
              activeConversationId={activeConversation?.id ?? ""}
              activePartnerId={activePartnerId ?? ""}
              locale={locale}
              sendAction={sendAction}
              translations={{
                realtimeNote: t("realtimeNote"),
                replyPlaceholder: t("replyPlaceholder"),
                send: t("send"),
                emptyMessages: t("emptyMessages"),
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
