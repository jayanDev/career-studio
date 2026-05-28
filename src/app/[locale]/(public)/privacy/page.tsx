import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Card, CardContent } from "@/components/ui/card";
import { defaultLocale, isLocale } from "@/i18n-config";

type LegalPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase2.meta.privacy" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

const LAST_UPDATED = "2026-05-28";

export default async function PrivacyPage({ params }: LegalPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase2.legal" });

  return (
    <div className="bg-white">
      <section className="border-b bg-gradient-to-br from-white via-teal-50 to-amber-50">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <SectionHeading
            eyebrow={t("eyebrow")}
            title="Privacy Policy"
            description="How Career Studio collects, uses, and protects your data. Last updated 2026-05-28."
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>This is a working draft.</strong> Career Studio is preparing for launch and this
          policy will be reviewed by counsel before general availability. If you have concerns
          before then, contact{" "}
          <a href="mailto:privacy@careerstudio.lk" className="font-medium underline-offset-2 hover:underline">
            privacy@careerstudio.lk
          </a>
          .
        </div>

        <Card className="bg-white">
          <CardContent className="space-y-8 p-6 text-sm leading-7 text-neutral-700">
            <Section title="1. Who we are">
              <p>
                Career Studio (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a Sri Lanka-based career
                technology platform. We operate <code>careerstudio.lk</code> and the associated
                career tools (ATS Checker, CV Builder, LinkedIn Optimizer, Career GPS, Cover
                Letter Writer, Graphical CV Builder, Talent Pool).
              </p>
            </Section>

            <Section title="2. What we collect">
              <p>We collect three categories of data, each for an explicit purpose:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Account data</strong> — name, email, password hash (or Google OAuth
                  identifier), preferred locale. Required to sign you in.
                </li>
                <li>
                  <strong>Content data</strong> — resumes, cover letters, ATS scans, LinkedIn
                  audits, career plans, mentorship messages, recruiter outreach, talent profile.
                  Created by you in the course of using the product.
                </li>
                <li>
                  <strong>Operational data</strong> — auth sessions, audit logs, share-view
                  analytics with hashed visitor identifiers, AI usage counters, error traces.
                  Used for service reliability, abuse prevention, and billing.
                </li>
              </ul>
              <p>
                We do not collect special-category data deliberately. Resumes can contain
                religious, ethnic, or health information — we treat the entire document as
                personal data and do not extract those signals for any purpose.
              </p>
            </Section>

            <Section title="3. How we use it">
              <ul className="list-disc space-y-2 pl-5">
                <li>To provide the tools you signed up for.</li>
                <li>
                  To run the AI features (Google Gemini). Your resume / JD / plan text is sent
                  to Google&apos;s API at the moment of generation. Google&apos;s data handling
                  is governed by their{" "}
                  <a
                    href="https://policies.google.com/terms/generative-ai"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    Generative AI terms
                  </a>
                  .
                </li>
                <li>
                  To send transactional emails (sign-up confirmation, password reset, share-link
                  notifications) via Resend. We do not send marketing emails without separate
                  consent.
                </li>
                <li>To process payments via Stripe for paid plans.</li>
                <li>To detect abuse and rate-limit expensive endpoints.</li>
              </ul>
            </Section>

            <Section title="4. Who we share it with">
              <p>We share data only with the processors listed below, and only to the extent
                needed for that processor to provide its service:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Google (Gemini API)</strong> — for AI-generated content.</li>
                <li><strong>Resend</strong> — for transactional email delivery.</li>
                <li><strong>Stripe</strong> — for paid-plan billing.</li>
                <li>
                  <strong>Cloud hosting providers</strong> — to host the database, application,
                  and file storage.
                </li>
              </ul>
              <p>
                We never sell personal data, never share it with advertisers, and never share it
                with recruiters except where you have explicitly opted into the Talent Pool and
                a recruiter has issued an outreach you accepted.
              </p>
            </Section>

            <Section title="5. How long we keep it">
              <ul className="list-disc space-y-2 pl-5">
                <li>Account + content data: until you delete it or your account.</li>
                <li>Operational logs / audit trail: 90 days.</li>
                <li>Share-view analytics: indefinitely after anonymisation (no user link).</li>
                <li>Billing records: 7 years (Sri Lanka tax requirements).</li>
              </ul>
            </Section>

            <Section title="6. Your rights">
              <p>You can exercise these rights without contacting us:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong>Export your data</strong> — Settings → Download my data. Single JSON
                  file containing every record we hold for you.
                </li>
                <li>
                  <strong>Delete your account</strong> — Settings → Delete my account. Permanent
                  cascade delete; we anonymise share-view analytics rather than tampering with
                  aggregate counts.
                </li>
                <li>
                  <strong>Withdraw consent</strong> — turn off optional analytics cookies from
                  the consent banner. Essential cookies (session, locale) remain because the
                  service can&apos;t run without them.
                </li>
              </ul>
              <p>
                If you want us to correct data or restrict processing, email{" "}
                <a href="mailto:privacy@careerstudio.lk" className="font-medium underline-offset-2 hover:underline">
                  privacy@careerstudio.lk
                </a>{" "}
                — we&apos;ll respond within 30 days.
              </p>
            </Section>

            <Section title="7. Security">
              <p>
                We use TLS for all traffic, encrypted backups, and least-privilege access for
                internal staff. Passwords are stored as bcrypt hashes (we never see your
                plaintext password). Account deletion is irreversible and runs inside a database
                transaction — partial deletes do not occur.
              </p>
            </Section>

            <Section title="8. Children">
              <p>
                Career Studio is intended for users 16 and older. We do not knowingly collect
                data from anyone younger. If you believe a child has signed up, email us and
                we&apos;ll delete the account.
              </p>
            </Section>

            <Section title="9. Changes">
              <p>
                Material changes will be announced via email to active accounts at least 14
                days before they take effect. You can review the latest version any time at{" "}
                <Link href={`/${locale}/privacy`} className="font-medium underline-offset-2 hover:underline">
                  /privacy
                </Link>
                .
              </p>
            </Section>

            <p className="pt-4 text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-neutral-950">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
