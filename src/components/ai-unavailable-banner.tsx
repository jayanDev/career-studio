/**
 * Reusable banner shown when an AI feature couldn't run with Gemini.
 *
 * Most generators on the platform (ATS scorer, Career GPS plan,
 * tailored resume, interview question generator, etc.) fall back to a
 * deterministic template when `GOOGLE_GENERATIVE_AI_API_KEY` is missing
 * or the upstream call fails. Without a visible signal, users see the
 * template output and assume it's the AI result. This banner makes the
 * degradation explicit.
 *
 * Server components can compute whether the AI key is available once
 * (env check) and pass the boolean down; client components can pass
 * `method === "fallback"` from the action's response.
 */

import { Info } from "lucide-react";

export function AiUnavailableBanner({
  reason = "no_key",
  className = "",
}: {
  reason?: "no_key" | "fallback" | "rate_limited";
  className?: string;
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    no_key: {
      title: "AI features unavailable",
      body: "The Gemini API key isn't configured on this environment. You're seeing template output, not personalised AI results. Ask your administrator to set GOOGLE_GENERATIVE_AI_API_KEY.",
    },
    fallback: {
      title: "Showing template output",
      body: "We couldn't reach Gemini for this request, so you're seeing a generic template instead of personalised AI output. Try again in a few minutes.",
    },
    rate_limited: {
      title: "AI rate-limited",
      body: "You've hit the Gemini rate limit on this environment. The result below is a template fallback. Wait a few minutes and try again.",
    },
  };

  const { title, body } = messages[reason];

  return (
    <div
      role="status"
      className={`flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 ${className}`}
    >
      <Info className="mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <p className="mt-1 text-xs leading-5">{body}</p>
      </div>
    </div>
  );
}

/**
 * Server-side helper: returns true if the Gemini key is present in env.
 * Use in server components / actions to decide whether to render the
 * banner with reason="no_key".
 */
export function isAiAvailable() {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}
