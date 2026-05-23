/**
 * A/B compare panel — side-by-side view of two ATS scans.
 *
 * Pure server-render: takes the precomputed CompareResult and lays out the
 * deltas. No state or events live here.
 */

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompareEntry, CompareResult } from "@/server/actions/ats/compare";

const bandClass: Record<CompareEntry["bandKey"], string> = {
  excellent: "bg-emerald-600",
  good: "bg-teal-700",
  fair: "bg-amber-600",
  poor: "bg-rose-600",
};

function Delta({ value, invertColour = false }: { value: number | null; invertColour?: boolean }) {
  if (value === null) {
    return <span className="text-xs text-neutral-400">—</span>;
  }
  if (value === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><ArrowRight className="size-3" /> 0</span>;
  }
  const positive = value > 0;
  // For "formatting hazards" higher is worse — invert the colour.
  const good = invertColour ? !positive : positive;
  const cls = good ? "text-emerald-700" : "text-rose-700";
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cls}`}>
      <Icon className="size-3" />
      {positive ? "+" : ""}{value}
    </span>
  );
}

function EntryHeader({ entry, label }: { entry: CompareEntry; label: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-neutral-900">{entry.filename}</div>
      <div className="text-xs text-neutral-500">
        {new Date(entry.createdAt).toLocaleString()}
        {entry.jdTitle ? ` · vs ${entry.jdTitle}` : ""}
      </div>
    </div>
  );
}

function Row({
  label,
  a,
  b,
  delta,
  suffix = "",
  invertColour = false,
}: {
  label: string;
  a: number | null | string;
  b: number | null | string;
  delta: number | null;
  suffix?: string;
  invertColour?: boolean;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-2 pr-3 text-sm font-medium text-neutral-700">{label}</td>
      <td className="px-3 text-right text-sm tabular-nums text-neutral-900">
        {a === null ? "—" : `${a}${suffix}`}
      </td>
      <td className="px-3 text-right text-sm tabular-nums text-neutral-900">
        {b === null ? "—" : `${b}${suffix}`}
      </td>
      <td className="pl-3 text-right">
        <Delta value={delta} invertColour={invertColour} />
      </td>
    </tr>
  );
}

export function ComparePanel({ result }: { result: CompareResult }) {
  const { a, b, delta, sharedKeywords } = result;

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Score deltas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-neutral-50 p-3">
              <EntryHeader entry={a} label="Scan A" />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-4xl font-semibold text-neutral-900">{a.overall}</span>
                <Badge className={`${bandClass[a.bandKey]} text-white`}>{a.bandLabel}</Badge>
              </div>
            </div>
            <div className="rounded-md border bg-neutral-50 p-3">
              <EntryHeader entry={b} label="Scan B" />
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-4xl font-semibold text-neutral-900">{b.overall}</span>
                <Badge className={`${bandClass[b.bandKey]} text-white`}>{b.bandLabel}</Badge>
              </div>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="py-2 pr-3">Metric</th>
                <th className="px-3 text-right">A</th>
                <th className="px-3 text-right">B</th>
                <th className="pl-3 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Overall" a={a.overall} b={b.overall} delta={delta.overall} />
              <Row label="Format" a={a.format} b={b.format} delta={delta.format} suffix="/25" />
              <Row label="Content" a={a.content} b={b.content} delta={delta.content} suffix="/25" />
              <Row label="Keywords" a={a.keywords} b={b.keywords} delta={delta.keywords} suffix="/25" />
              <Row label="Length" a={a.length} b={b.length} delta={delta.length} suffix="/25" />
              <Row
                label="JD match"
                a={a.jdKeywordMatchPct}
                b={b.jdKeywordMatchPct}
                delta={delta.jdMatch}
                suffix="%"
              />
              <Row
                label="Bullet impact"
                a={`${a.bulletImpact}/100 (${a.totalBullets} bullets)`}
                b={`${b.bulletImpact}/100 (${b.totalBullets} bullets)`}
                delta={delta.bulletImpact}
              />
              <Row
                label="Formatting hazards"
                a={a.formattingHazards}
                b={b.formattingHazards}
                delta={delta.formattingHazards}
                invertColour
              />
              <Row
                label="Section sub-score"
                a={a.sectionTotal}
                b={b.sectionTotal}
                delta={
                  a.sectionTotal !== null && b.sectionTotal !== null
                    ? b.sectionTotal - a.sectionTotal
                    : null
                }
                suffix="/100"
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {sharedKeywords.gained.length > 0 || sharedKeywords.lost.length > 0 ? (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Keyword diff (top matches)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <KeywordList title={`Gained (${sharedKeywords.gained.length})`} items={sharedKeywords.gained} tone="good" />
              <KeywordList title={`Lost (${sharedKeywords.lost.length})`} items={sharedKeywords.lost} tone="bad" />
              <KeywordList title={`Kept (${sharedKeywords.kept.length})`} items={sharedKeywords.kept} tone="neutral" />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KeywordList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-100 text-emerald-900"
      : tone === "bad"
        ? "bg-rose-100 text-rose-900"
        : "bg-neutral-100 text-neutral-800";
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</div>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-400">—</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 30).map((k) => (
            <span key={k} className={`rounded px-2 py-0.5 text-[11px] ${cls}`}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
