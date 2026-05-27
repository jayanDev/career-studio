import type { MetadataRoute } from "next";

import { locales } from "@/i18n-config";

/**
 * sitemap.xml — lists the public marketing routes for each locale.
 *
 * Authenticated routes, share URLs, and recruiter-internal pages are
 * intentionally NOT listed — they're excluded by robots.ts and never
 * need to surface in search.
 */
const PUBLIC_PATHS = [
  "", // home
  "/tools",
  "/courses",
  "/resources",
  "/blog",
  "/pricing",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://careerstudio.lk").replace(/\/$/, "");
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    for (const path of PUBLIC_PATHS) {
      entries.push({
        url: `${baseUrl}/${locale}${path}`,
        lastModified,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.6,
      });
    }
  }
  return entries;
}
