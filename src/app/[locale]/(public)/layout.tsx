import { CookieConsentBanner } from "@/components/cookie-consent";
import { PublicNav } from "@/components/nav/public-nav";
import { defaultLocale, isLocale } from "@/i18n-config";
import { getTranslations } from "next-intl/server";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-background">
      <PublicNav locale={locale} />
      <main>{children}</main>
      <footer className="border-t bg-slate-950 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3">
          <div>
            <div className="text-lg font-semibold">{t("Career Studio")}</div>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              {t("Sri Lankan career tools for every step")}
            </p>
          </div>
          <div>
            <div className="font-semibold">{t("Quick Links")}</div>
            <div className="mt-3 grid gap-2 text-sm text-slate-400">
              <span>{t("Tools")}</span>
              <span>{t("Courses")}</span>
              <span>{t("Blog")}</span>
            </div>
          </div>
          <div>
            <div className="font-semibold">{t("Legal")}</div>
            <div className="mt-3 grid gap-2 text-sm text-slate-400">
              <span>{t("Privacy Policy")}</span>
              <span>{t("Terms of Service")}</span>
              <span>{t("Feedback")}</span>
            </div>
          </div>
        </div>
      </footer>
      <CookieConsentBanner locale={locale} />
    </div>
  );
}
