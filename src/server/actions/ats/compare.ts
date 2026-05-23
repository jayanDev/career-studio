"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { interpretScore } from "@/lib/ats-scoring";
import type { BulletReport } from "@/lib/ats/bullets";
import type { FormattingReport } from "@/lib/ats/formatting";
import type { JdAnalysis, JdMatchResult } from "@/lib/ats/jd-extraction";
import type { SectionScoreReport } from "@/lib/ats/section-scoring";
import { prisma } from "@/lib/prisma";

export type CompareEntry = {
  id: string;
  filename: string;
  createdAt: string;
  overall: number;
  format: number;
  content: number;
  keywords: number;
  length: number;
  bandLabel: string;
  bandKey: "poor" | "fair" | "good" | "excellent";
  jdKeywordMatchPct: number | null;
  jdTitle: string | null;
  bulletImpact: number;
  totalBullets: number;
  formattingHazards: number;
  sectionTotal: number | null;
};

export type CompareResult = {
  a: CompareEntry;
  b: CompareEntry;
  /** b - a; positive means b improved. */
  delta: {
    overall: number;
    format: number;
    content: number;
    keywords: number;
    length: number;
    jdMatch: number | null;
    bulletImpact: number;
    formattingHazards: number;
  };
  sharedKeywords: { gained: string[]; lost: string[]; kept: string[] };
};

type StoredScores = {
  jdAnalysis?: JdAnalysis;
  jdMatch?: JdMatchResult;
  bullets?: BulletReport;
  formatting?: FormattingReport;
  sectionScores?: SectionScoreReport;
};

async function loadEntry(id: string, userId: string): Promise<CompareEntry> {
  const row = await prisma.aTSCheckResult.findUnique({
    where: { id },
    include: { cvDocument: { select: { id: true, filename: true, userId: true } } },
  });
  if (!row || row.cvDocument.userId !== userId) {
    throw new Error(`ATS result ${id} not found`);
  }
  const stored = row.scores as unknown as StoredScores;
  const interp = interpretScore(row.overallScore);
  return {
    id: row.id,
    filename: row.cvDocument.filename,
    createdAt: row.createdAt.toISOString(),
    overall: row.overallScore,
    format: row.formatScore,
    content: row.contentScore,
    keywords: row.keywordsScore,
    length: row.lengthScore,
    bandLabel: interp.label,
    bandKey: interp.band,
    jdKeywordMatchPct: row.jdKeywordMatchPct,
    jdTitle: stored.jdAnalysis?.job_title ?? null,
    bulletImpact: stored.bullets?.overallImpactScore ?? 0,
    totalBullets: stored.bullets?.totalBullets ?? 0,
    formattingHazards: stored.formatting?.hazards.length ?? 0,
    sectionTotal: stored.sectionScores?.total ?? null,
  };
}

function diffKeywordSets(aKeywords: string[], bKeywords: string[]) {
  const aSet = new Set(aKeywords.map((s) => s.toLowerCase()));
  const bSet = new Set(bKeywords.map((s) => s.toLowerCase()));
  const gained = bKeywords.filter((k) => !aSet.has(k.toLowerCase()));
  const lost = aKeywords.filter((k) => !bSet.has(k.toLowerCase()));
  const kept = aKeywords.filter((k) => bSet.has(k.toLowerCase()));
  return { gained, lost, kept };
}

export async function compareAtsResultsAction(
  idA: string,
  idB: string,
): Promise<CompareResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/en/auth/sign-in");
  const userId = session.user.id;

  if (!idA || !idB) throw new Error("Both IDs are required");
  if (idA === idB) throw new Error("Pick two different scans to compare");

  const [a, b] = await Promise.all([loadEntry(idA, userId), loadEntry(idB, userId)]);

  // Load keyword diffs from the persisted jdTopKeywords (already on the row)
  const [rowA, rowB] = await Promise.all([
    prisma.aTSCheckResult.findUnique({ where: { id: idA }, select: { jdTopKeywords: true } }),
    prisma.aTSCheckResult.findUnique({ where: { id: idB }, select: { jdTopKeywords: true } }),
  ]);
  const kwA = ((rowA?.jdTopKeywords ?? []) as unknown as string[]) ?? [];
  const kwB = ((rowB?.jdTopKeywords ?? []) as unknown as string[]) ?? [];

  return {
    a,
    b,
    delta: {
      overall: b.overall - a.overall,
      format: b.format - a.format,
      content: b.content - a.content,
      keywords: b.keywords - a.keywords,
      length: b.length - a.length,
      jdMatch:
        a.jdKeywordMatchPct !== null && b.jdKeywordMatchPct !== null
          ? b.jdKeywordMatchPct - a.jdKeywordMatchPct
          : null,
      bulletImpact: b.bulletImpact - a.bulletImpact,
      formattingHazards: b.formattingHazards - a.formattingHazards,
    },
    sharedKeywords: diffKeywordSets(kwA, kwB),
  };
}
