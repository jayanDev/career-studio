import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { interpretScore } from "@/lib/ats-scoring";
import { prisma } from "@/lib/prisma";
import { maskList, maskText } from "@/lib/share-mask";
import { recordShareView } from "@/lib/share-views";

type SharePageProps = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export const metadata: Metadata = {
  title: "Shared ATS Report",
  robots: { index: false, follow: false },
};

/**
 * Public ATS share page.
 *
 * Gating: a scan is only visible publicly when the row has a `shareToken`
 * AND the requesting URL provides the matching `?token=` query param.
 * This prevents anyone with a guessed `atsCheckResultId` UUID from
 * reading another candidate's analysis. Every free-text field that
 * could embed PII (issues, suggestions, JD top keywords, sub-analysis
 * snippets) is run through the masking helpers.
 */
export default async function SharedAtsReportPage({ params, searchParams }: SharePageProps) {
  const { id } = await params;
  const { token } = await searchParams;

  const row = await prisma.aTSCheckResult.findUnique({
    where: { id },
    include: { cvDocument: { select: { userId: true } } },
  });
  if (!row) notFound();

  // Hard ownership gate: no shareToken on the row OR no `?token=` in URL OR
  // mismatch → 404. Without this any logged-out user could iterate UUIDs.
  if (!row.shareToken || !token || row.shareToken !== token) {
    notFound();
  }

  await recordShareView({
    type: "ats",
    itemId: id,
    ownerId: row.cvDocument.userId ?? undefined,
    headers: await headers(),
  });

  const interp = interpretScore(row.overallScore);
  const issues = maskList(((row.issues as unknown) as string[]) ?? []);
  const suggestions = maskList(((row.suggestions as unknown) as string[]) ?? []);
  const jdTopKeywords = ((row.jdTopKeywords as unknown) as string[]) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        Public ATS report — personal contact details have been redacted. The candidate controls
        visibility and can revoke this link at any time.
      </div>

      <Card className="bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ATS Analysis (anonymised)</CardTitle>
          <span className="text-xs text-neutral-500">
            Generated {new Date(row.createdAt).toLocaleDateString()}
          </span>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-6xl font-semibold tracking-tight text-neutral-950">
                {row.overallScore}
              </div>
              <Badge
                className={`mt-2 rounded-md ${
                  interp.band === "excellent"
                    ? "bg-emerald-600"
                    : interp.band === "good"
                      ? "bg-teal-700"
                      : interp.band === "fair"
                        ? "bg-amber-600"
                        : "bg-rose-600"
                }`}
              >
                {interp.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Format" value={row.formatScore} />
              <Stat label="Content" value={row.contentScore} />
              <Stat label="Keywords" value={row.keywordsScore} />
              <Stat label="Length" value={row.lengthScore} />
            </div>
          </div>

          {row.jdKeywordMatchPct !== null ? (
            <div className="mt-6 rounded-md border bg-amber-50 p-4">
              <div className="font-semibold text-amber-950">
                JD match: {row.jdKeywordMatchPct}%
              </div>
              {jdTopKeywords.length > 0 ? (
                <p className="mt-2 text-sm leading-6 text-amber-950/75">
                  {jdTopKeywords.slice(0, 12).join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <List title="Issues" items={issues} />
          <List title="Suggestions" items={suggestions} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-neutral-50 p-3">
      <div className="text-xl font-semibold text-neutral-950">{value}/25</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="font-semibold text-neutral-950">{title}</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
