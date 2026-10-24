import { test, expect } from "@playwright/test";

/**
 * Regression test for the "I can't click into email inbox" bug fixed on
 * 2026-10-23 (PR #6): a 326-item unfiled backlog rendered every filing
 * form at once, making the page huge and unresponsive on mobile. Fix was
 * capping the Unfiled section to 20 with a "Show all" link, same as
 * "Filed & ignored" already had.
 *
 * Workflow tier — seeds synthetic unfiled emails via the QA-only
 * /api/qa/seed route (a 404 against any real database, see that route's
 * comment), so this never touches production data.
 */
test("Unfiled section paginates instead of rendering a large backlog at once", async ({ page, request }) => {
  // Reset first — the in-memory store is shared across tests in this run
  // (see lib/store.ts), so a prior test's seeded data must not leak in
  // and throw off the exact counts this test asserts on.
  await request.post("/api/qa/seed", { data: { action: "reset" } });
  const seed = await request.post("/api/qa/seed", { data: { action: "seed-unfiled-emails", count: 30 } });
  expect(seed.ok(), "QA seed route must succeed — if this 404s, QA_BASE_URL is pointed at a real database, which this test must never run against").toBeTruthy();

  await page.goto("/inbox");
  await expect(page.locator('h2:has-text("Unfiled")')).toContainText("30");

  const forms = page.locator('form:has(select[name="kind"])');
  await expect(forms).toHaveCount(20);

  const showAll = page.locator('a:has-text("Show all")').first();
  await expect(showAll).toBeVisible();
  await expect(showAll).toContainText("30");

  await showAll.click();
  await expect(forms).toHaveCount(30);
});
