import type { PlanTier } from "@prisma/client";
import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import { baseAuthConfig } from "@/auth.config";
import { defaultLocale, isLocale, locales } from "@/i18n-config";
import { planRank } from "@/lib/plans";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

const protectedRoutes = new Set([
  "/dashboard",
  "/admin",
  "/resumes",
  "/ats",
  "/cover-letter",
  "/gcv",
  "/job-tracker",
  "/interview",
  "/salary",
  "/career-gps",
  "/linkedin",
  "/messaging",
  "/forum",
  "/connections",
  "/mentorship",
  "/notifications",
  "/billing",
  "/settings",
]);

const planGates: Record<string, PlanTier> = {
  "/career-gps": "pro",
  "/gcv": "pro",
  "/linkedin": "pro",
  "/messaging": "premium",
  "/connections": "premium",
};

function getLocalizedPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : undefined;
  const appPath = locale ? `/${segments.slice(1).join("/")}` : pathname;

  return {
    locale,
    appPath: appPath === "/" ? "/" : appPath.replace(/\/$/, ""),
  };
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const { auth } = NextAuth(baseAuthConfig);

export default auth((request) => {
  const { locale, appPath } = getLocalizedPath(request.nextUrl.pathname);

  if (!locale) {
    return intlMiddleware(request);
  }

  const needsAuth = Array.from(protectedRoutes).some((route) => matchesRoute(appPath, route));

  if (needsAuth && !request.auth?.user) {
    const signInUrl = new URL(`/${locale}/auth/sign-in`, request.url);
    signInUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(signInUrl);
  }

  const requiredPlan = Object.entries(planGates).find(([route]) => matchesRoute(appPath, route))?.[1];

  if (matchesRoute(appPath, "/admin") && !request.auth?.user?.isStaff) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  if (requiredPlan) {
    const currentPlan = request.auth?.user?.planTier ?? "basic";

    if (planRank[currentPlan] < planRank[requiredPlan]) {
      const billingUrl = new URL(`/${locale}/billing`, request.url);
      billingUrl.searchParams.set("upgrade", requiredPlan);
      billingUrl.searchParams.set("from", request.nextUrl.pathname);

      return NextResponse.redirect(billingUrl);
    }
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
