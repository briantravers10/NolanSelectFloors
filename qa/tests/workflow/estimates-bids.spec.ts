import { test, expect } from "@playwright/test";

/**
 * Workflow tier — filing an inbound email as a Potential Bid lands it in
 * /bids, and once filed it can never be filed again from Unfiled (the
 * app's actual duplicate-prevention mechanism: a filed email simply isn't
 * in the Unfiled list anymore to re-file — see app/inbox/actions.ts).
 */
test("filing an email as a Potential Bid lists it in Bids, and it can't be filed twice", async ({ page, request }) => {
  await request.post("/api/qa/seed", { data: { action: "reset" } });
  await request.post("/api/qa/seed", { data: { action: "seed-unfiled-emails", count: 1 } });

  await page.goto("/inbox");
  const form = page.locator("form", { has: page.locator('select[name="kind"]') }).first();
  await form.locator('select[name="kind"]').selectOption("bid");
  await form.getByRole("button", { name: /file/i }).click();
  await page.waitForLoadState("networkidle");

  // Gone from Unfiled — the actual mechanism that prevents re-filing it.
  await expect(page.locator('h2:has-text("Unfiled")')).toContainText("Unfiled — 0");

  await page.goto("/bids");
  await expect(page.getByText("QA synthetic unfiled email 0")).toBeVisible();

  // It now lives under "Filed & ignored" on Inbox, not Unfiled — filing
  // it a second time isn't a UI action that exists for an already-filed
  // email, so this is the real invariant: no double-count in Bids.
  const bidCount = await page.getByText("QA synthetic unfiled email 0").count();
  expect(bidCount).toBe(1);
});
