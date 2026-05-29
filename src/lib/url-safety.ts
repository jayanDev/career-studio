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
