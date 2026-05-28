import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Production security headers.
 *
 * Applied to every route. Public share pages render arbitrary
 * user-uploaded content and masked candidate reports; X-Frame-Options
 * prevents clickjacking attacks where a malicious site iframes the share
 * page to phish credentials. Permissions-Policy locks down APIs we don't
 * use (mic, camera, geolocation) so a future XSS can't trivially escalate.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Content-Security-Policy in REPORT-ONLY mode for now. Next.js still
  // emits inline scripts for hydration without nonces, so enforcing a
  // strict policy would break the app. Report-only lets us watch real
  // violations in the browser console before flipping to enforcement.
  //
  // To enforce later:
  //   1. Rename header to `Content-Security-Policy`
  //   2. Generate per-request nonces via middleware and inject into the
  //      script-src directive
  //   3. Drop `'unsafe-inline'` / `'unsafe-eval'` from script-src
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com https://generativelanguage.googleapis.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["file-type", "unpdf", "mammoth", "@react-pdf/renderer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

// @next/bundle-analyzer is a no-op unless ANALYZE=true is set in the
// environment. Run `npm run analyze` to inspect bundle bloat.
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

export default withBundleAnalyzer(withNextIntl(nextConfig));
