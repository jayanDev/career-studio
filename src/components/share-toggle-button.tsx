"use client";

/**
 * Reusable Share / Stop-sharing button.
 *
 * Wraps `setShareTokenAction` for any shareable entity (resume, cover
 * letter, GCV, LinkedIn audit, Career GPS plan). On click:
 *   - Calls the server action to flip the shareToken
 *   - If sharing is now enabled, builds the public URL with the new
 *     token, writes it to the clipboard, and shows a copied banner
 *   - If disabled, clears the banner
 *
 * The public URL each kind maps to is centralised here so wiring a new
 * editor is a one-line drop-in.
 */

import { useState, useTransition } from "react";
import { Copy, Loader2, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  setShareTokenAction,
  type ShareKind,
  type ShareToggleResult,
} from "@/server/actions/share-toggle";

const SHARE_URLS: Record<ShareKind, (id: string, token: string, locale: string) => string> = {
  resume: (id, token) => `/r/${id}?token=${token}`,
  "cover-letter": (id, token) => `/cl/${id}?token=${token}`,
  gcv: (id, token) => `/g/${id}?token=${token}`,
  linkedin: (id, token) => `/linkedin/share/${id}?token=${token}`,
  "career-gps": (id, token) => `/career-gps/share/${id}?token=${token}`,
};

export function ShareToggleButton({
  kind,
  id,
  initiallyShared = false,
  initialToken = null,
  locale = "en",
  size = "sm",
  variant = "outline",
  className = "",
  labels = {
    share: "Share",
    stop: "Stop sharing",
    copy: "Copy link",
    copied: "Copied!",
    error: "Could not toggle sharing",
  },
}: {
  kind: ShareKind;
  id: string;
  initiallyShared?: boolean;
  initialToken?: string | null;
  locale?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  labels?: {
    share: string;
    stop: string;
    copy: string;
    copied: string;
    error: string;
  };
}) {
  const [state, setState] = useState<ShareToggleResult>({
    isShared: initiallyShared,
    shareToken: initialToken,
    sharedAt: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl =
    state.isShared && state.shareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${SHARE_URLS[kind](id, state.shareToken, locale)}`
      : null;

  function toggle() {
    setError(null);
    const next = !state.isShared;
    startTransition(async () => {
      try {
        const result = await setShareTokenAction(kind, id, next);
        setState(result);
        if (result.isShared && result.shareToken && typeof window !== "undefined") {
          const url = `${window.location.origin}${SHARE_URLS[kind](id, result.shareToken, locale)}`;
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard write can fail if the page isn't on https or the
            // user denies permission. Surface a generic error.
            setError(labels.error);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : labels.error);
      }
    });
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(labels.error);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant={variant} size={size} onClick={toggle} disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Share2 className="size-3.5" />}
          {state.isShared ? labels.stop : labels.share}
        </Button>
        {shareUrl ? (
          <Button type="button" variant="ghost" size={size} onClick={copyLink} disabled={isPending}>
            <Copy className="size-3.5" />
            {copied ? labels.copied : labels.copy}
          </Button>
        ) : null}
      </div>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
      {shareUrl ? (
        <code className="block max-w-md truncate rounded bg-neutral-50 px-2 py-1 text-[10px] text-neutral-600">
          {shareUrl}
        </code>
      ) : null}
    </div>
  );
}
