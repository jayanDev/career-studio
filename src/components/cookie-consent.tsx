"use client";

/**
 * Cookie-consent banner.
 *
 * Shown until the visitor explicitly chooses. We default to NOT setting
 * any non-essential cookies — the banner is informational + opt-in, in
 * line with GDPR Art. 7 and Sri Lanka's PDPA "free, specific, informed,
 * unambiguous" requirement.
 *
 * The decision (`accepted` / `rejected`) is persisted in a first-party
 * cookie via `document.cookie` so the same browser doesn't get
 * re-prompted on every page load.
 *
 * Essential cookies (session, CSRF, locale, theme) are NOT gated by
 * this banner — they are necessary for the service. Analytics /
 * marketing cookies (currently none) would key off the stored
 * decision.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

const COOKIE_NAME = "cs_consent";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

type ConsentDecision = "accepted" | "rejected" | null;

function readDecision(): ConsentDecision {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = match?.split("=")[1];
  if (value === "accepted" || value === "rejected") return value;
  return null;
}

function writeDecision(decision: Exclude<ConsentDecision, null>) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${decision}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function CookieConsentBanner({ locale = "en" }: { locale?: string }) {
  // Render nothing on the server pass — the cookie is browser-side, so
  // any SSR markup would flash incorrectly. We mount client-only.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(readDecision() === null);
  }, []);

  if (!mounted || !visible) return null;

  function decide(decision: "accepted" | "rejected") {
    writeDecision(decision);
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-xl border border-neutral-200 bg-white p-4 shadow-lg md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-neutral-950">We use cookies</h2>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Career Studio uses essential cookies to keep you signed in and your work saved. We&apos;d
            like to use a small set of optional analytics cookies to understand which tools help
            our users most — they&apos;re never shared with advertisers. See our{" "}
            <Link href={`/${locale}/privacy`} className="font-medium text-teal-700 underline-offset-2 hover:underline">
              privacy policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => decide("rejected")}
            className="text-xs"
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => decide("accepted")}
            className="bg-teal-700 text-xs text-white hover:bg-teal-800"
          >
            Accept all
          </Button>
          <button
            type="button"
            onClick={() => decide("rejected")}
            aria-label="Dismiss — defaults to essential only"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
