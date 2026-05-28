/**
 * Observability seam.
 *
 * Centralises the "log an error worth investigating" call so the rest
 * of the codebase doesn't need to know which APM provider is wired in.
 *
 * Today: logs to `console.error` with a request-id when given one.
 * Tomorrow: swap the body of `captureError` for a Sentry / Datadog /
 * Highlight / etc. client and every existing call site benefits.
 *
 * Design:
 *   - No-op friendly. The wrapper never throws even if the underlying
 *     provider does.
 *   - Provider-agnostic. We don't import @sentry/* anywhere else.
 *   - Request-aware. Every call accepts an optional `requestId` so
 *     production logs can be correlated with the x-request-id middleware
 *     stamps on every response.
 *   - Scoped tags. `feature` lets us filter by tool (ats, linkedin,
 *     career-gps, stripe, etc.) once a real APM is plugged in.
 *
 * To wire real Sentry later:
 *   1. `npm i @sentry/nextjs`
 *   2. Add `instrumentation.ts` with the Sentry init
 *   3. Replace the bodies below with `Sentry.captureException` + tags
 *   The call sites do not need to change.
 */

export type ErrorContext = {
  /** Per-request correlation id stamped by middleware. */
  requestId?: string;
  /** Coarse-grained feature area: "ats", "linkedin", "stripe", etc. */
  feature?: string;
  /** Free-form extras logged alongside the error. */
  extra?: Record<string, unknown>;
};

/**
 * Capture an unexpected error for later investigation. Safe to call
 * from any runtime (Edge, Node, browser).
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  try {
    const reqId = context.requestId ? `[${context.requestId}] ` : "";
    const tag = context.feature ? `[${context.feature}] ` : "";
    const payload = context.extra ? ` extra=${JSON.stringify(safeExtra(context.extra))}` : "";

    // We deliberately use `console.error` here. In production this lands
    // in stdout, which whichever log shipper is configured (Vercel,
    // CloudWatch, Datadog Logs) will pick up.
     
    console.error(`${reqId}${tag}${formatError(error)}${payload}`);
  } catch {
    // Observability must never break the call site. Swallow and move on.
  }
}

/**
 * Capture an informational message — non-error events that still need
 * to be visible in production logs (rate-limit hits, fallback paths,
 * skipped processors).
 */
export function captureMessage(message: string, context: ErrorContext = {}): void {
  try {
    const reqId = context.requestId ? `[${context.requestId}] ` : "";
    const tag = context.feature ? `[${context.feature}] ` : "";
    const payload = context.extra ? ` extra=${JSON.stringify(safeExtra(context.extra))}` : "";
     
    console.info(`${reqId}${tag}${message}${payload}`);
  } catch {
    // ignored
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ""}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function safeExtra(extra: Record<string, unknown>): Record<string, unknown> {
  // Drop obviously huge values so a stray buffer doesn't dump 5MB into
  // the log line.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      out[key] = `<binary ${"byteLength" in value ? value.byteLength : "unknown"}>`;
      continue;
    }
    if (typeof value === "string" && value.length > 2000) {
      out[key] = `${value.slice(0, 2000)}…(truncated ${value.length - 2000}b)`;
      continue;
    }
    out[key] = value;
  }
  return out;
}
