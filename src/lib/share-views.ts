import { createHash } from "crypto";

import { prisma } from "@/lib/prisma";

/**
 * Share-view analytics — persisted via Prisma so the data survives
 * deploys and works on serverless platforms (Vercel / Netlify / Cloud
 * Run). The previous implementation wrote to `.next/share-views.jsonl`
 * which is wiped on every build and unwritable on most serverless
 * filesystems.
 */

export type ShareViewType =
  | "resume"
  | "cover-letter"
  | "gcv"
  | "linkedin"
  | "career-gps"
  | "ats";

export type ShareViewRecord = {
  id: string;
  type: ShareViewType;
  itemId: string;
  ownerId?: string | null;
  viewedAt: string;
  visitorHash: string;
  referrer: string;
  userAgent: string;
};

type HeaderReader = Pick<Headers, "get">;

function headerValue(headers: HeaderReader, key: string) {
  return headers.get(key) || "";
}

function visitorHashFromHeaders(headers: HeaderReader) {
  const forwardedFor = headerValue(headers, "x-forwarded-for").split(",")[0]?.trim();
  const ip = forwardedFor || headerValue(headers, "x-real-ip") || "unknown";
  const userAgent = headerValue(headers, "user-agent") || "unknown";
  return createHash("sha256").update(`${ip}|${userAgent}`).digest("hex");
}

export async function recordShareView(input: {
  type: ShareViewType;
  itemId: string;
  ownerId?: string;
  headers: HeaderReader;
}) {
  try {
    await prisma.shareView.create({
      data: {
        type: input.type,
        itemId: input.itemId,
        ownerId: input.ownerId ?? null,
        visitorHash: visitorHashFromHeaders(input.headers),
        referrer: headerValue(input.headers, "referer") || "direct",
        userAgent: headerValue(input.headers, "user-agent").slice(0, 180),
      },
    });
  } catch (error) {
    // View analytics should never break a public share page rendering.
    console.warn("[share-views] failed to record view:", error);
  }
}

export async function readShareViews(filters: {
  ownerId: string;
  type?: ShareViewType | null;
  itemId?: string | null;
}): Promise<ShareViewRecord[]> {
  const rows = await prisma.shareView.findMany({
    where: {
      ownerId: filters.ownerId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.itemId ? { itemId: filters.itemId } : {}),
    },
    orderBy: { viewedAt: "desc" },
    take: 500,
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type as ShareViewType,
    itemId: row.itemId,
    ownerId: row.ownerId,
    viewedAt: row.viewedAt.toISOString(),
    visitorHash: row.visitorHash,
    referrer: row.referrer,
    userAgent: row.userAgent,
  }));
}
