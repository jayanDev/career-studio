/**
 * SSRF guard for any endpoint that fetches a user-supplied URL.
 *
 * Two scrapers use this: /api/ats/scrape-jd and /api/linkedin/scrape-jd.
 * Both accept a URL from the client and `fetch()` it server-side, so
 * without filtering they would be trivially coercible into:
 *   - reading cloud metadata (169.254.169.254 on AWS/GCP)
 *   - hitting internal services on the VPC (10.x, 172.16-31.x, 192.168.x)
 *   - reading the local filesystem (`file://`, gopher://, etc.)
 *
 * The hostname allow-rules are intentionally minimal. The heavy lift is
 * "must parse as http(s) with a real public hostname." A determined
 * attacker with control over a DNS record could still resolve a public
 * hostname to a private IP; defeating that requires resolving the host
 * ourselves and re-checking the IP — out of scope for the current
 * threat model (authenticated users, rate-limited).
 */

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^127\./, // IPv4 loopback
  /^10\./, // RFC1918 private
  /^192\.168\./, // RFC1918 private
  /^169\.254\./, // Link-local — cloud metadata lives here
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 private
];

const BLOCKED_HOST_EXACT = new Set(["localhost", "0.0.0.0", "::1", "[::1]"]);

const BLOCKED_HOST_SUFFIXES = [".local", ".internal"];

/**
 * Default body cap for scrapers: 2 MiB of decoded text. Real job
 * postings are far smaller; a 2 MiB ceiling still leaves headroom
 * for noisy pages without letting a hostile origin stream a 5 GiB
 * payload into our worker.
 */
export const DEFAULT_FETCH_CAP_BYTES = 2 * 1024 * 1024;

/** Default wall-clock budget for a scrape fetch. */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * Response content-types a scraper is willing to read. Anything else
 * (images, PDFs, octet-streams) is pointless to text-decode for a job
 * posting and is usually a sign the URL points at the wrong resource —
 * or an attacker trying to feed us a giant binary.
 */
export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  "text/html",
  "text/plain",
  "text/xml",
  "application/xhtml",
  "application/xml",
];

export class FetchCapExceeded extends Error {
  constructor(public readonly cap: number) {
    super(`Response exceeded ${cap} bytes`);
    this.name = "FetchCapExceeded";
  }
}

export class FetchContentTypeRejected extends Error {
  constructor(public readonly contentType: string) {
    super(`Unsupported content-type: ${contentType || "(none)"}`);
    this.name = "FetchContentTypeRejected";
  }
}

export class FetchTimeout extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeout";
  }
}

type FetchTextWithCapOptions = RequestInit & {
  maxBytes?: number;
  timeoutMs?: number;
  /** Content-type prefixes to accept. Pass `[]` to skip the check. */
  allowedContentTypes?: string[];
};

/**
 * Fetch a URL as text with three guards layered on top of `fetch`:
 *
 *   1. Timeout — aborts after `timeoutMs` so a slow-loris origin can't
 *      pin a worker open indefinitely.
 *   2. Content-type — rejects responses that aren't text/HTML/XML before
 *      reading the body.
 *   3. Size cap — rejects on an oversized advertised `content-length`,
 *      and aborts mid-stream the moment the decoded body exceeds the cap.
 *
 * Callers must still pre-validate the URL with `isSafeUrl`.
 */
export async function fetchTextWithCap(
  url: string,
  init: FetchTextWithCapOptions = {},
): Promise<{ status: number; ok: boolean; text: string }> {
  const {
    maxBytes = DEFAULT_FETCH_CAP_BYTES,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    allowedContentTypes = DEFAULT_ALLOWED_CONTENT_TYPES,
    signal: callerSignal,
    ...fetchInit
  } = init;

  // Wire up a timeout abort that composes with any caller-provided signal.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    let res: Response;
    try {
      res = await fetch(url, { ...fetchInit, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new FetchTimeout(timeoutMs);
      throw error;
    }

    // Content-type guard. Empty content-type is tolerated (some origins
    // omit it); a present-but-unsupported type is rejected.
    if (allowedContentTypes.length > 0) {
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (contentType && !allowedContentTypes.some((prefix) => contentType.startsWith(prefix))) {
        try {
          await res.body?.cancel();
        } catch {
          /* ignore */
        }
        throw new FetchContentTypeRejected(contentType);
      }
    }

    const advertised = Number(res.headers.get("content-length") ?? NaN);
    if (Number.isFinite(advertised) && advertised > maxBytes) {
      // Hang up immediately — no point reading a body we'd reject.
      try {
        await res.body?.cancel();
      } catch {
        /* ignore */
      }
      throw new FetchCapExceeded(maxBytes);
    }

    if (!res.body) {
      const text = await res.text();
      return { status: res.status, ok: res.ok, text };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let received = 0;
    let text = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            try {
              await reader.cancel();
            } catch {
              /* ignore */
            }
            throw new FetchCapExceeded(maxBytes);
          }
          text += decoder.decode(value, { stream: true });
        }
      }
      text += decoder.decode();
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }

    return { status: res.status, ok: res.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

export function isSafeUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (BLOCKED_HOST_EXACT.has(host)) return false;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return false;
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return false;
  }
  return true;
}
