import type { Metadata } from "next";
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
  const t = await getTranslations({ locale, namespace: "phase2.meta.terms" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

const LAST_UPDATED = "2026-05-28";

export default async function TermsPage({ params }: LegalPageProps) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const t = await getTranslations({ locale, namespace: "phase2.legal" });
  void locale;

  return (
    <div className="bg-white">
      <section className="border-b bg-gradient-to-br from-white via-teal-50 to-amber-50">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <SectionHeading
            eyebrow={t("eyebrow")}
            title="Terms of Service"
            description="The rules of using Career Studio. Last updated 2026-05-28."
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>This is a working draft.</strong> Pending legal review before general
          availability. By using Career Studio today you accept these terms as written, with
          the understanding that material changes will be communicated to active accounts at
          least 14 days before they take effect.
        </div>

        <Card className="bg-white">
          <CardContent className="space-y-8 p-6 text-sm leading-7 text-neutral-700">
            <Section title="1. Acceptance">
              <p>
                By creating an account or using Career Studio you agree to these terms and our
                Privacy Policy. If you do not agree, do not create an account.
              </p>
            </Section>

            <Section title="2. What you can do">
              <ul className="list-disc space-y-2 pl-5">
                <li>Use the platform for your own job search, career planning, and hiring.</li>
                <li>Upload only content you have the right to upload.</li>
                <li>Share your own resumes, reports, and career plans with whomever you like.</li>
                <li>Use the AI features to draft, rewrite, and refine your own content.</li>
              </ul>
            </Section>

            <Section title="3. What you can&apos;t do">
              <ul className="list-disc space-y-2 pl-5">
                <li>Use the platform to send unsolicited messages or impersonate other people.</li>
                <li>
                  Submit content that infringes copyright or contains someone else&apos;s personal
                  data without their consent.
                </li>
                <li>
                  Probe, scrape, or attempt to overwhelm the platform. The rate-limited AI
                  endpoints are not an open API.
                </li>
                <li>
                  Use a single account on behalf of many people. Recruiter accounts may represent
                  a company, but the signed-in individual is responsible for outreach quality.
                </li>
                <li>Resell, sublicense, or proxy the AI generations to third parties.</li>
              </ul>
            </Section>

            <Section title="4. AI-generated content">
              <p>
                Our tools use Google Gemini and similar AI models to draft text, suggest
                bullets, and analyse resumes. <strong>You are responsible for reviewing AI
                output before using it.</strong> AI can produce confident-sounding but incorrect
                claims, especially about specific numbers, dates, employers, and certifications.
                Don&apos;t submit an AI-generated resume to an employer without reading every
                line first.
              </p>
            </Section>

            <Section title="5. Paid plans">
              <ul className="list-disc space-y-2 pl-5">
                <li>Billing is handled by Stripe. We never see your card number.</li>
                <li>
                  Plans renew automatically. Cancel any time from Settings → Billing — your
                  access continues until the end of the current period.
                </li>
                <li>
                  Refunds: we refund unused months on annual plans within 14 days of charge, and
                  refund prorated unused days on monthly plans if you cancel within 48 hours of
                  a renewal you didn&apos;t intend.
                </li>
                <li>Recruiter plans have separate terms — see Settings → Recruiter billing.</li>
              </ul>
            </Section>

            <Section title="6. Termination">
              <p>
                You can delete your account at any time from Settings → Delete my account. We
                may terminate accounts that violate these terms, with reasonable notice unless
                the violation is severe (impersonation, mass abuse, payment fraud).
              </p>
            </Section>

            <Section title="7. Disclaimers">
              <p>
                Career Studio is a tool to help you present yourself and find opportunities. We
                do not guarantee employment outcomes, recruiter responses, salary levels, or the
                accuracy of AI suggestions. The service is provided as-is, without warranty of
                fitness for any particular purpose, to the maximum extent permitted by Sri Lanka
                law.
              </p>
            </Section>

            <Section title="8. Liability">
              <p>
                Our total liability to you for any claim arising from your use of the platform
                is limited to the amount you paid us in the 12 months immediately preceding the
                claim, or LKR 5,000, whichever is greater. We are not liable for indirect,
                incidental, or consequential damages.
              </p>
            </Section>

            <Section title="9. Governing law">
              <p>
                These terms are governed by the laws of Sri Lanka. Any dispute will be resolved
                in the courts of Colombo, unless a different forum is required by mandatory
                consumer-protection law.
              </p>
            </Section>

            <Section title="10. Contact">
              <p>
                Questions or complaints —{" "}
                <a
                  href="mailto:support@careerstudio.lk"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  support@careerstudio.lk
                </a>
                . Privacy-specific requests —{" "}
                <a
                  href="mailto:privacy@careerstudio.lk"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  privacy@careerstudio.lk
                </a>
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
