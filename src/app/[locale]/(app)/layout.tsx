import { getTranslations } from "next-intl/server";

import { LangSwitcher } from "@/components/lang-switcher";
import { PlanTierBadge } from "@/components/account/plan-tier-badge";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { AppSidebar } from "@/components/nav/app-sidebar";
import { defaultLocale, isLocale } from "@/i18n-config";
import { auth } from "@/lib/auth";

export default async function AuthenticatedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations();
  const session = await auth();
  const planTier = session?.user.planTier ?? "basic";

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar locale={locale} planTier={planTier} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="font-semibold">{t("Dashboard")}</div>
            <PlanTierBadge planTier={planTier} label={t(`phase2.plans.${planTier}`)} />
          </div>
          <div className="flex items-center gap-2">
            <LangSwitcher />
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
        <FeedbackWidget locale={locale} />
      </div>
    </div>
  );
}
