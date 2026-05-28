import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BadgeCheck, CalendarDays, Copy, Download, KeyRound, LogOut, Mail, Shield, Sparkles, UserRound } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { PlanTierBadge } from "@/components/account/plan-tier-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";
import { planLimits } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { ensureUserProfile } from "@/server/services/accounts";
import { signOutCurrentSession, updateAccountEmail, updateProfile } from "@/server/actions/accounts";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function percentage(used: number, limit: number) {
  return Math.min(Math.round((used / limit) * 100), 100);
}

function quotaColor(value: number) {
  if (value < 50) {
    return "bg-teal-600";
  }

  if (value < 80) {
    return "bg-amber-500";
  }

  return "bg-rose-600";
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase2.meta.settings" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function SettingsPage({ params, searchParams }: SettingsPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "phase2.settings" });
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true },
  });

  if (!user) {
    redirect(`/${locale}/auth/sign-in`);
  }

  const profile = user.profile ?? (await ensureUserProfile(user.id));
  const limits = planLimits[profile.planTier];
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const aiUsed = await prisma.aIUsageLog.count({
    where: {
      userId: user.id,
      success: true,
      createdAt: {
        gte: monthStart,
      },
    },
  });
  const quotas = [
    {
      label: t("dailyExports"),
      icon: Download,
      used: profile.dailyExportsCount,
      limit: limits.dailyExports,
      remainingLabel: t("remainingToday"),
    },
    {
      label: t("monthlyAts"),
      icon: BadgeCheck,
      used: profile.monthlyAtsChecks,
      limit: limits.monthlyAts,
      remainingLabel: t("remainingMonth"),
    },
    {
      label: t("monthlyAi"),
      icon: Sparkles,
      used: aiUsed,
      limit: limits.monthlyAi,
      remainingLabel: t("remainingMonth"),
    },
  ];
  const nextReward = profile.totalReferrals % 5 === 0 ? 5 : 5 - (profile.totalReferrals % 5);
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}` || user.email[0]?.toUpperCase() || "U";
  const saved = firstParam(query.saved);
  const error = firstParam(query.error);
  const savedKey = ["profile", "email"].includes(saved) ? saved : "default";
  const errorKey = ["profile", "email", "email-taken"].includes(error) ? error : "default";
  const profileAction = updateProfile.bind(null, locale);
  const emailAction = updateAccountEmail.bind(null, locale);
  const signOutAction = signOutCurrentSession.bind(null, locale);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">{t("title")}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t("subtitle")}</p>
      </div>

      {saved ? (
        <Alert className="border-teal-200 bg-teal-50 text-teal-950">
          <AlertDescription>{t(`saved.${savedKey}`)}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{t(`errors.${errorKey}`)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          {["profile", "account", "plan", "referrals", "danger"].map((item) => (
            <a key={item} href={`#${item}`} className="flex items-center rounded-md border bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
              {t(`nav.${item}`)}
            </a>
          ))}
        </aside>

        <div className="space-y-6">
          <Card id="profile" className="bg-white">
            <CardHeader>
              <CardTitle>{t("profileTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex items-center gap-4">
                <div className="flex size-16 items-center justify-center rounded-full bg-teal-100 text-xl font-semibold text-teal-900">
                  {initials}
                </div>
                <div>
                  <div className="font-semibold text-neutral-950">{`${user.firstName} ${user.lastName}`.trim() || user.email}</div>
                  <div className="text-sm text-neutral-600">{user.email}</div>
                  <div className="mt-2">
                    <PlanTierBadge planTier={profile.planTier} label={t(`plans.${profile.planTier}`)} />
                  </div>
                </div>
              </div>

              <form action={profileAction} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">{t("firstName")}</Label>
                  <Input id="firstName" name="firstName" defaultValue={user.firstName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">{t("lastName")}</Label>
                  <Input id="lastName" name="lastName" defaultValue={user.lastName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input id="phone" name="phone" defaultValue={profile.phone} placeholder="+94 77 123 4567" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedinUrl">{t("linkedinUrl")}</Label>
                  <Input id="linkedinUrl" name="linkedinUrl" defaultValue={profile.linkedinUrl} placeholder="https://linkedin.com/in/..." />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="bg-teal-700 text-white hover:bg-teal-800">
                    {t("saveProfile")}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card id="account" className="bg-white">
            <CardHeader>
              <CardTitle>{t("accountTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={emailAction} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("email")}</Label>
                  <Input id="email" name="email" type="email" defaultValue={user.email} required />
                </div>
                <Button type="submit" variant="outline">
                  <Mail className="size-4" />
                  {t("updateEmail")}
                </Button>
              </form>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border bg-neutral-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-950">
                    <CalendarDays className="size-4 text-teal-700" />
                    {t("memberSince")}
                  </div>
                  <div className="mt-2 text-sm text-neutral-600">{user.dateJoined.toLocaleDateString("en-LK")}</div>
                </div>
                <div className="rounded-md border bg-neutral-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-neutral-950">
                    <KeyRound className="size-4 text-teal-700" />
                    {t("accountId")}
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-neutral-600">{user.id}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="plan" className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>{t("planTitle")}</CardTitle>
                <PlanTierBadge planTier={profile.planTier} label={t(`plans.${profile.planTier}`)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm leading-6 text-neutral-600">{t(`planCopy.${profile.planTier}`)}</p>
              <Button asChild variant="outline">
                <Link href={`/${locale}/pricing`}>{t("viewPricing")}</Link>
              </Button>
              <div className="grid gap-4">
                {quotas.map((quota) => {
                  const pct = percentage(quota.used, quota.limit);
                  const Icon = quota.icon;

                  return (
                    <div key={quota.label}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 font-medium text-neutral-800">
                          <Icon className="size-4 text-teal-700" />
                          {quota.label}
                        </span>
                        <span className="text-neutral-500">
                          {quota.used} / {quota.limit}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                        <div className={`h-full ${quotaColor(pct)}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        {Math.max(quota.limit - quota.used, 0)} {quota.remainingLabel}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card id="referrals" className="bg-white">
            <CardHeader>
              <CardTitle>{t("referralsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-neutral-600">{t("referralsBody")}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Metric label={t("totalReferrals")} value={profile.totalReferrals.toString()} />
                <Metric label={t("proEarned")} value={profile.proTemplatesEarned.toString()} />
                <Metric label={t("nextReward")} value={nextReward.toString()} />
              </div>
              <div className="mt-5 rounded-md border border-dashed bg-neutral-50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">{t("referralCode")}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <code className="rounded-md bg-white px-3 py-2 text-lg font-semibold tracking-[0.18em] text-teal-900">
                    {profile.referralCode}
                  </code>
                  <Badge variant="outline" className="rounded-md">
                    <Copy className="size-3" />
                    {t("copyInBrowser")}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="danger" className="border-rose-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="size-5" />
                {t("dangerTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
                <span>
                  <span className="flex items-center gap-2 font-medium text-neutral-950">
                    <Shield className="size-4 text-amber-700" />
                    {t("signOutTitle")}
                  </span>
                  <span className="mt-1 block text-sm text-neutral-600">{t("signOutBody")}</span>
                </span>
                <form action={signOutAction}>
                  <Button type="submit" variant="outline">
                    <LogOut className="size-4" />
                    {t("signOut")}
                  </Button>
                </form>
              </div>
              <div className="flex flex-col gap-3 rounded-md border border-sky-200 bg-sky-50 p-4 md:flex-row md:items-center md:justify-between">
                <span>
                  <span className="flex items-center gap-2 font-medium text-sky-900">
                    <Download className="size-4" />
                    Export my data
                  </span>
                  <span className="mt-1 block text-sm text-sky-900/75">
                    Download every record we hold for you as a single JSON file. Satisfies your right of access under GDPR.
                  </span>
                </span>
                <Button asChild variant="outline">
                  <Link href="/api/account/export" target="_blank" rel="noreferrer">
                    <Download className="size-4" />
                    Download JSON
                  </Link>
                </Button>
              </div>
              <DeleteAccountCard accountEmail={user.email ?? ""} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-neutral-50 p-4 text-center">
      <div className="text-2xl font-semibold text-neutral-950">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{label}</div>
    </div>
  );
}
