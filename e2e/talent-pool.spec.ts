import { test, expect } from '@playwright/test';

test.describe('Talent Pool Smoke Test', () => {
  test('Recruiter can view talent pool analytics and pipeline', async ({ page }) => {
    // 1. Visit Talent Pool home
    await page.goto('/en/talent-pool');
    
    // We expect basic UI elements like page title to be present
    // Assuming there's a heading for Talent Pool or "Talent Search"
    await expect(page.locator('h1').first()).toBeVisible();

    // 2. Navigate to Analytics
    await page.goto('/en/talent-pool/analytics');
    await expect(page.locator('text=Market Intelligence').first()).toBeVisible();
    await expect(page.locator('text=Platform Candidate Pool').first()).toBeVisible();

    // 3. Navigate to a dummy project pipeline (Kanban)
    // We mock the navigation since we don't have a real DB seeded in this test,
    // but a real E2E test would create a project and then navigate to it.
    await page.goto('/en/talent-pool/projects/1');
    
    // Basic kanban UI should render (e.g., Export CSV button, columns)
    await expect(page.locator('text=Export CSV').first()).toBeVisible();
  });
});
