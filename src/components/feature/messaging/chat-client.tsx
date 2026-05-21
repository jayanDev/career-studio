"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Paperclip, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getConversationMessagesAction } from "@/server/actions/messaging/messages";
import { displayName } from "@/lib/community";
import type { Locale } from "@/i18n-config";

interface ChatClientProps {
  initialMessages: any[];
  initialSenders: any[];
  initialAttachments: any[];
  currentUserId: string;
  activeConversationId: string;
  activePartnerId: string;
  locale: Locale;
  sendAction: (formData: FormData) => Promise<any>;
  translations: {
    realtimeNote: string;
    replyPlaceholder: string;
    send: string;
    emptyMessages: string;
  };
}

export function ChatClient({
  initialMessages,
  initialSenders,
  initialAttachments,
  currentUserId,
  activeConversationId,
  activePartnerId,
  locale,
  sendAction,
  translations,
}: ChatClientProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [senders, setSenders] = useState(initialSenders);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Group attachments by message id
  const attachmentsByMessage = useMemo(() => {
    const map = new Map<string, any[]>();
    attachments.forEach((a) => {
      if (!map.has(a.messageId)) {
        map.set(a.messageId, []);
      }
      map.get(a.messageId)!.push(a);
    });
    return map;
  }, [attachments]);

  const senderMap = useMemo(() => {
    return new Map<string, any>(senders.map((s) => [s.id, s]));
  }, [senders]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling logic
  useEffect(() => {
    if (!activeConversationId) return;

    const interval = setInterval(async () => {
      setIsSyncing(true);
      try {
        const data = await getConversationMessagesAction(locale, activeConversationId);
        // Only update if there are changes to minimize re-renders
        if (JSON.stringify(data.messages) !== JSON.stringify(messages)) {
          setMessages(data.messages);
        }
        setSenders(data.senders);
        setAttachments(data.attachments);
      } catch (err) {
        console.error("Failed to poll messages:", err);
      } finally {
        setIsSyncing(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeConversationId, locale, messages]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSending) return;

    const formData = new FormData(e.currentTarget);
    const body = formData.get("body") as string;
    if (!body || !body.trim()) return;

    setIsSending(true);
    try {
      await sendAction(formData);
      formRef.current?.reset();
      
      // Immediately fetch latest messages
      const data = await getConversationMessagesAction(locale, activeConversationId);
      setMessages(data.messages);
      setSenders(data.senders);
      setAttachments(data.attachments);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Safe custom Markdown & code block syntax highlighting parser
  const renderMessageContent = (text: string, isMine: boolean) => {
    if (!text) return null;

    // Split by code blocks (```...```)
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const match = part.match(/```(\w*)\n([\s\S]*?)```/);
        const language = match ? match[1] : "";
        const code = match ? match[2] : part.slice(3, -3);

        return (
          <pre
            key={idx}
            className={`my-2 overflow-x-auto rounded-lg border p-3.5 text-xs font-mono shadow-inner ${
              isMine
                ? "bg-teal-900/60 border-teal-600/40 text-neutral-100"
                : "bg-neutral-900 border-neutral-800 text-neutral-200"
            }`}
          >
            {language && (
              <div className="mb-1 text-[10px] uppercase tracking-wider font-bold opacity-60">
                {language}
              </div>
            )}
            <code>{code.trim()}</code>
          </pre>
        );
      }

      // Inline code blocks (`code`)
      const inlineParts = part.split(/(`[^`\n]+`)/g);
      return (
        <span key={idx} className="whitespace-pre-wrap">
          {inlineParts.map((subPart, subIdx) => {
            if (subPart.startsWith("`") && subPart.endsWith("`")) {
              return (
                <code
                  key={subIdx}
                  className={`rounded px-1.5 py-0.5 text-xs font-mono font-semibold ${
                    isMine
                      ? "bg-teal-800/80 text-white"
                      : "bg-neutral-200 text-neutral-800"
                  }`}
                >
                  {subPart.slice(1, -1)}
                </code>
              );
            }

            // Links [text](url)
            const linkParts = subPart.split(/(\[[^\]]+\]\([^)]+\))/g);
            return linkParts.map((linkPart, linkIdx) => {
              const linkMatch = linkPart.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                const [, linkText, linkUrl] = linkMatch;
                return (
                  <a
                    key={linkIdx}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`underline font-medium hover:opacity-80 transition ${
                      isMine ? "text-white" : "text-teal-600"
                    }`}
                  >
                    {linkText}
                  </a>
                );
              }

              // Bold **bold**
              const boldParts = linkPart.split(/(\*\*[^*]+\*\*)/g);
              return boldParts.map((boldPart, boldIdx) => {
                if (boldPart.startsWith("**") && boldPart.endsWith("**")) {
                  return (
                    <strong key={boldIdx} className="font-extrabold">
                      {boldPart.slice(2, -2)}
                    </strong>
                  );
                }

                // Italic *italic*
                const italicParts = boldPart.split(/(\*[^*]+\*)/g);
                return italicParts.map((italicPart, italicIdx) => {
                  if (italicPart.startsWith("*") && italicPart.endsWith("*")) {
                    return (
                      <em key={italicIdx} className="italic">
                        {italicPart.slice(1, -1)}
                      </em>
                    );
                  }
                  return italicPart;
                });
              });
            });
          })}
        </span>
      );
    });
  };

  return (
    <>
      <div className="relative flex flex-col min-h-[420px] max-h-[500px] overflow-y-auto rounded-lg border bg-neutral-50 p-4 space-y-4">
        {/* Real-time Status Badge */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-600 shadow-sm border border-neutral-100">
          <span className={`relative flex h-2 w-2`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSyncing ? "bg-teal-400" : "bg-emerald-400"}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isSyncing ? "bg-teal-500" : "bg-emerald-500"}`}></span>
          </span>
          {isSyncing ? "Syncing..." : "Live"}
        </div>

        {messages.map((message) => {
          const isMine = message.senderId === currentUserId;
          const files = attachmentsByMessage.get(message.id) ?? [];
          const sender = senderMap.get(message.senderId);

          return (
            <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm border transition-all ${
                  isMine
                    ? "bg-teal-700 border-teal-600 text-white rounded-br-none"
                    : "bg-white border-neutral-200 text-neutral-900 rounded-bl-none"
                }`}
              >
                <div className={`text-[10px] font-semibold mb-1 opacity-75`}>
                  {displayName(sender ?? {})}
                </div>
                <div className="text-sm leading-relaxed">
                  {renderMessageContent(message.body, isMine)}
                </div>
                {files.map((file) => (
                  <Badge
                    key={file.id}
                    variant="outline"
                    className={`mt-2.5 flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs border ${
                      isMine
                        ? "bg-teal-800/80 text-white border-teal-600/50"
                        : "bg-neutral-50 text-neutral-700 border-neutral-200"
                    }`}
                  >
                    <Paperclip className="size-3" />
                    <span className="truncate max-w-[150px]">{file.filename}</span>
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-neutral-400">{translations.emptyMessages}</p>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      {activePartnerId ? (
        <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3 pt-2">
          <input type="hidden" name="recipientId" value={activePartnerId} />
          <Textarea
            name="body"
            placeholder={translations.replyPlaceholder}
            className="min-h-[80px] bg-white border border-neutral-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            required
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 max-w-xs">
              <Paperclip className="size-4 text-neutral-400 shrink-0" />
              <Input
                name="attachment"
                type="file"
                className="bg-white text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
              />
            </div>
            <Button
              type="submit"
              disabled={isSending}
              className="bg-teal-700 text-white hover:bg-teal-800 shadow-sm transition-all px-5 py-2 h-auto"
            >
              <Send className="size-4 mr-1.5" />
              {isSending ? "Sending..." : translations.send}
            </Button>
          </div>
        </form>
      ) : null}
    </>
  );
}
