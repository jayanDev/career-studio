import type { MetadataRoute } from "next";

/**
 * robots.txt — explicitly excludes every public share-link surface.
 *
 * Public share URLs carry user-uploaded content (cover image, redacted
 * resume, anonymised career plan). We never want them indexed by search
 * engines because (a) the URLs are unguessable but discoverable via
 * referrer leaks, and (b) even masked content shouldn't end up in
 * cached search results. Same logic for recruiter-internal pages.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://careerstudio.lk";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          // API routes never need to be indexed
          "/api/",
          // Share / token-gated public surfaces
          "/r/",
          "/g/",
          "/cl/",
          "/ats/share/",
          "/career-gps/share/",
          "/linkedin/share/",
          "/talent/", // public talent profiles — keep them opt-in via the public talent dashboard
          // Authenticated app surface
          "/en/(app)/",
          "/si/(app)/",
          "/ta/(app)/",
          // Auth flows
          "/en/auth/",
          "/si/auth/",
          "/ta/auth/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
