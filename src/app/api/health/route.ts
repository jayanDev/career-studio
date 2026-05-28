import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRequestId } from "@/lib/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe for uptime monitors (BetterUptime, UptimeRobot,
 * Vercel monitoring, etc.).
 *
 * Returns 200 with `{ status: "ok" }` when the runtime can reach the
 * database. Returns 503 with `{ status: "degraded", error }` when the DB
 * ping fails — the worker is still serving traffic, but dependent
 * features (auth, billing, persistence) will misbehave, so it's worth
 * paging on.
 *
 * Deliberately:
 *   - No auth: monitors can't carry session cookies.
 *   - No PII: response body is fixed shape, safe to log.
 *   - Force-dynamic: skip the Next.js ISR cache; we want a fresh ping
 *     every time.
 */
export async function GET(request: Request) {
  const reqId = getRequestId(request);
  const startedAt = Date.now();

  try {
    // Cheapest round-trip that still proves the connection works.
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    return NextResponse.json(
      {
        status: "degraded",
        component: "database",
        error: error instanceof Error ? error.message : "unknown",
        latencyMs: Date.now() - startedAt,
      },
      { status: 503, headers: { "x-request-id": reqId, "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      status: "ok",
      latencyMs: Date.now() - startedAt,
      // Build-time stamp lets the monitor surface "stuck on old build"
      // without us needing a separate /version endpoint.
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    },
    { headers: { "x-request-id": reqId, "cache-control": "no-store" } },
  );
}
