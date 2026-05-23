import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readShareViews, type ShareViewType } from "@/lib/share-views";

export const runtime = "nodejs";

const shareTypes = new Set(["resume", "cover-letter", "gcv", "linkedin", "career-gps"]);

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get("type");
  const itemId = url.searchParams.get("itemId");
  const type = typeParam && shareTypes.has(typeParam) ? (typeParam as ShareViewType) : null;
  const views = await readShareViews({ ownerId: session.user.id, type, itemId });

  const referrers = views.reduce<Record<string, number>>((acc, view) => {
    const key = view.referrer || "direct";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const uniqueVisitors = new Set(views.map((view) => view.visitorHash)).size;

  return NextResponse.json({
    totalViews: views.length,
    uniqueVisitors,
    referrers: Object.entries(referrers)
      .map(([referrer, count]) => ({ referrer, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recentViews: views
      .slice(-25)
      .reverse()
      .map((view) => ({
        type: view.type,
        itemId: view.itemId,
        viewedAt: view.viewedAt,
        referrer: view.referrer,
        userAgent: view.userAgent,
      })),
  });
}
