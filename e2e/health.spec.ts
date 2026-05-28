import { expect, test } from "@playwright/test";

/**
 * Uptime-monitor contract test.
 *
 * The `/api/health` endpoint is consumed by external monitors
 * (BetterUptime, UptimeRobot, Vercel) — its response shape is part of the
 * contract. If we ever break the shape, alerts will fire silently. Pin
 * the contract here so any regression fails CI loudly.
 */
test.describe("Health endpoint", () => {
  test("returns 200 with documented shape", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["x-request-id"]).toBeTruthy();
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.latencyMs).toBe("number");
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    // commit is `null` locally; Vercel injects VERCEL_GIT_COMMIT_SHA.
    expect(body).toHaveProperty("commit");
  });
});
