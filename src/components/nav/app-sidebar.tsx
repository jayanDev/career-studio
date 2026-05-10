import Link from "next/link";
import {
  Bell,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Compass,
  CreditCard,
  FileText,
  Gauge,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  Network,
  PenLine,
  Presentation,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { PlanTier } from "@prisma/client";

import { PlanTierBadge } from "@/components/account/plan-tier-badge";
import { Separator } from "@/components/ui/separator";
import type { Locale } from "@/i18n-config";

const sidebarItems = [
  ["Dashboard", "dashboard", LayoutDashboard],
  ["Resumes", "resumes", FileText],
  ["ATS Checker", "ats", ShieldCheck],
  ["Cover Letters", "cover-letter", PenLine],
  ["Graphical CV", "gcv", Presentation],
  ["Job Tracker", "job-tracker", BriefcaseBusiness],
  ["Interview", "interview", MessageSquare],
  ["Salary Insights", "salary", Gauge],
  ["Career GPS", "career-gps", Compass],
  ["LinkedIn Optimizer", "linkedin", BadgeCheck],
  ["Messages", "messaging", MessageSquare],
  ["Forum", "forum", Users],
  ["Connections", "connections", Network],
  ["Mentorship", "mentorship", Handshake],
  ["Notifications", "notifications", Bell],
  ["Admin", "admin", ShieldCheck],
  ["Billing", "billing", CreditCard],
  ["Settings", "settings", Settings],
] as const;

export async function AppSidebar({ locale, planTier }: { locale: Locale; planTier: PlanTier }) {
  const t = await getTranslations();
  const prefix = `/${locale}`;

  return (
    <aside className="hidden min-h-screen w-72 shrink-0 border-r bg-card lg:block">
      <div className="flex h-16 items-center gap-2 px-5">
        <span className="flex size-9 items-center justify-center rounded-md bg-teal-700 text-white">
          <BriefcaseBusiness className="size-5" />
        </span>
        <span className="font-semibold">{t("Career Studio")}</span>
      </div>
      <div className="px-5 pb-4">
        <PlanTierBadge planTier={planTier} label={t(`phase2.plans.${planTier}`)} />
      </div>
      <Separator />
      <nav className="grid gap-1 p-3">
        {sidebarItems.map(([label, href, Icon]) => (
          <Link
            key={href}
            href={`${prefix}/${href}`}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icon className="size-4" />
            {t(label)}
          </Link>
        ))}
      </nav>
      <div className="mt-3 px-6 text-xs text-muted-foreground">
        <BookOpen className="mb-2 size-4" />
        {t("Sri Lanka first")}
      </div>
    </aside>
  );
}
