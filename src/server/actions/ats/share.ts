"use server";

import { randomUUID } from "crypto";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ShareState = {
  isShared: boolean;
  shareToken: string | null;
  sharedAt: string | null;
};

async function loadAndAuth(atsCheckResultId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorised");
  }
  const userId = session.user.id;

  const row = await prisma.aTSCheckResult.findUnique({
    where: { id: atsCheckResultId },
    include: { cvDocument: { select: { userId: true } } },
  });
  if (!row || row.cvDocument.userId !== userId) {
    throw new Error("ATS result not found");
  }
  return row;
}

/**
 * Toggle the public share token on an ATSCheckResult.
 *
 * Generates a random UUID token when enabling, clears the token (and the
 * sharedAt timestamp) when disabling. The public ATS share page checks
 * the URL `?token=` against this column — without a matching token the
 * page returns 404 even if a visitor guesses the row UUID.
 */
export async function setAtsShareAction(
  atsCheckResultId: string,
  isShared: boolean,
): Promise<ShareState> {
  await loadAndAuth(atsCheckResultId);

  const updated = await prisma.aTSCheckResult.update({
    where: { id: atsCheckResultId },
    data: isShared
      ? { shareToken: randomUUID(), sharedAt: new Date() }
      : { shareToken: null, sharedAt: null },
    select: { shareToken: true, sharedAt: true },
  });

  return {
    isShared: !!updated.shareToken,
    shareToken: updated.shareToken,
    sharedAt: updated.sharedAt?.toISOString() ?? null,
  };
}

export async function getAtsShareAction(atsCheckResultId: string): Promise<ShareState> {
  const row = await loadAndAuth(atsCheckResultId);
  return {
    isShared: !!row.shareToken,
    shareToken: row.shareToken,
    sharedAt: row.sharedAt?.toISOString() ?? null,
  };
}
