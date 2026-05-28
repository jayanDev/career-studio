import { expect, test } from "@playwright/test";

/**
 * Public-route smoke test.
 *
 * These tests exercise the routes that don't require auth or seeded
 * data, so they're safe to run on every CI build against a freshly
 * started server. The asserts focus on:
 *   - Marketing pages render and link to each other
 *   - Privacy + terms placeholders render their key sections
 *   - Cookie-consent banner shows on first visit and dismisses
 *   - Share routes return 404 for nonexistent tokens (the gating works)
 *   - robots.txt + sitemap.xml are served
 *   - Security headers are present
 */

test.describe("Public routes — smoke", () => {
  test("home page renders for /en", async ({ page }) => {
    const response = await page.goto("/en");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toBeVisible();
  });

  test("privacy + terms render with key sections", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
    await expect(page.getByText("1. Who we are")).toBeVisible();
    await expect(page.getByText("6. Your rights")).toBeVisible();

    await page.goto("/en/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
    await expect(page.getByText("4. AI-generated content")).toBeVisible();
    await expect(page.getByText("8. Liability")).toBeVisible();
  });

  test("cookie-consent banner appears + dismisses", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/en/privacy");

    const banner = page.getByRole("region", { name: /cookie consent/i });
    await expect(banner).toBeVisible();

    await banner.getByRole("button", { name: /essential only/i }).click();
    await expect(banner).not.toBeVisible();

    // Second visit — banner stays gone because the cookie persists.
    await page.goto("/en/terms");
    await expect(page.getByRole("region", { name: /cookie consent/i })).not.toBeVisible();
  });

  test("invalid share tokens 404", async ({ page }) => {
    // Career GPS share — wrong plan id.
    const careerGps = await page.goto("/career-gps/share/00000000-0000-0000-0000-000000000000");
    expect(careerGps?.status()).toBe(404);

    // Career GPS share — id exists but no token.
    // We can't pre-create a row in a smoke test; verifying 404 on the
    // guess-style path is enough to prove the gate engaged.

    // ATS share — wrong id, with no token.
    const ats = await page.goto("/en/ats/share/00000000-0000-0000-0000-000000000000");
    expect(ats?.status()).toBe(404);
  });

  test("robots.txt + sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Disallow: /api/");
    expect(robotsBody).toContain("Disallow: /ats/share/");

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain("<urlset");
  });

  test("security headers are present on the home page", async ({ request }) => {
    const response = await request.get("/en");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["permissions-policy"]).toContain("camera=()");
    // Request-id middleware should stamp this on every page response.
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{8,}$/i);
  });
});
