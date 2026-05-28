/**
 * Lightweight in-memory token-bucket rate limiter.
 *
 * Built for API routes that hit expensive third-party services (Gemini,
 * Stripe, Resend) or that are public and therefore worth abuse-protecting
 * (share-link viewers, signup, JD scraper).
 *
 * Trade-offs:
 *   - In-process map; works fine on a single Node instance. Behind a
 *     load balancer with multiple instances each instance has its own
 *     bucket — limits are effectively multiplied by replica count. For
 *     a real prod deploy upgrade to Upstash Redis with the same
 *     `consume(key, limit, window)` interface.
 *   - Resets on process restart (lambda cold start, deploy). Acceptable
 *     for abuse-prevention; not acceptable for billing throttling.
 *   - Memory is bounded by a sweep that drops empty buckets older than
 *     the largest configured window. No background timer; sweep happens
 *     opportunistically on `consume`.
 */

type Bucket = {
  tokens: number;
  lastRefill: number;
  windowMs: number;
  capacity: number;
};

const buckets = new Map<string, Bucket>();

/** When to evict empty buckets we haven't touched. Keep generous. */
const SWEEP_AFTER_MS = 60 * 60 * 1000;
let lastSweep = Date.now();

function maybeSweep(now: number) {
  if (now - lastSweep < SWEEP_AFTER_MS) return;
  for (const [key, b] of buckets) {
    if (now - b.lastRefill > SWEEP_AFTER_MS && b.tokens >= b.capacity) {
      buckets.delete(key);
    }
  }
  lastSweep = now;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Try to consume one request from `key`'s bucket.
 *
 * @param key      unique identifier — typically `${scope}:${userIdOrIp}`
 * @param limit    requests allowed in the window
 * @param windowMs window size in milliseconds
 */
export function consume(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  maybeSweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.windowMs !== windowMs || bucket.capacity !== limit) {
    bucket = { tokens: limit, lastRefill: now, windowMs, capacity: limit };
    buckets.set(key, bucket);
  } else {
    // Refill tokens proportionally to elapsed time.
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      const refill = (elapsed / windowMs) * limit;
      bucket.tokens = Math.min(limit, bucket.tokens + refill);
      bucket.lastRefill = now;
    }
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  // Compute how long until at least 1 token is available.
  const deficit = 1 - bucket.tokens;
  const waitMs = (deficit / limit) * windowMs;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.ceil(waitMs / 1000),
  };
}

/**
 * Extract a stable rate-limit key from a request. Prefers a stable user
 * id when the caller is authenticated; falls back to the x-forwarded-for
 * IP and finally to a fixed "anonymous" bucket (which shares a single
 * bucket across all anon traffic — fine for abuse prevention).
 */
export function rateLimitKey(scope: string, opts: {
  userId?: string | null;
  request?: Request;
}): string {
  if (opts.userId) return `${scope}:user:${opts.userId}`;
  const xff = opts.request?.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || opts.request?.headers.get("x-real-ip") || "anon";
  return `${scope}:ip:${ip}`;
}

/**
 * Common preset limits. Tune in code rather than env so changes go
 * through review.
 */
export const RATE_LIMITS = {
  /** AI-heavy endpoints — Gemini cost protection. */
  ai: { limit: 20, windowMs: 60_000 },
  /** Share-page public reads — abuse prevention on enumeration. */
  publicShare: { limit: 60, windowMs: 60_000 },
  /** JD URL scraper — protects against being used as an open scraper. */
  scrape: { limit: 10, windowMs: 60_000 },
  /** Stripe webhook — should never trigger but a circuit breaker is cheap. */
  webhook: { limit: 100, windowMs: 60_000 },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

/**
 * Convenience wrapper for App Router route handlers. Returns a Response
 * (HTTP 429) if rate-limited, or `null` if the caller can proceed.
 *
 *   const limited = await enforceRateLimit("ai", request, userId);
 *   if (limited) return limited;
 */
export async function enforceRateLimit(
  scope: RateLimitScope,
  request: Request,
  userId?: string | null,
): Promise<Response | null> {
  const preset = RATE_LIMITS[scope];
  const key = rateLimitKey(scope, { userId, request });
  const result = consume(key, preset.limit, preset.windowMs);
  if (result.allowed) return null;

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfterSeconds: result.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": `${result.retryAfterSeconds}`,
        "X-RateLimit-Limit": `${preset.limit}`,
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
