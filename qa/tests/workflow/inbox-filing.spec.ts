import { test, expect } from "@playwright/test";

/** Workflow tier — filing an unfiled email as a Drawing moves it off the
 * Unfiled list, same path an office employee uses daily. */
test("filing an unfiled email as a Drawing removes it from Unfiled", async ({ page, request }) => {
  await request.post("/api/qa/seed", { data: { action: "reset" } });
  const seed = await request.post("/api/qa/seed", { data: { action: "seed-unfiled-emails", count: 1 } });
  expect(seed.ok()).toBeTruthy();

  await page.goto("/inbox");
  await expect(page.getByText("QA synthetic unfiled email 0")).toBeVisible();

  const form = page.locator("form", { has: page.locator('select[name="kind"]') }).first();
  await form.locator('select[name="kind"]').selectOption("drawing");

  // JobPicker — type to find any existing job and pick the first match.
  const jobInput = form.locator('input[type="text"]').first();
  await jobInput.click();
  await jobInput.fill("a");
  await page.locator('div[class*="absolute"] button[type="button"]').first().click();

  await form.getByRole("button", { name: /file/i }).click();
  await page.waitForLoadState("networkidle");

  // Filed items still show up read-only under "Filed & ignored" lower on
  // the page — what actually matters is that it's off the Unfiled list.
  await expect(page.locator('h2:has-text("Unfiled")')).toContainText("Unfiled — 0");
});
