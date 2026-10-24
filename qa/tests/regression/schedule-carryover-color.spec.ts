import { test, expect } from "@playwright/test";

/**
 * Regression test for the "jobs carried over to the next day show up blue"
 * bug fixed on 2026-10-23 (PR #7): the Edit form defaulted the Schedule
 * Type dropdown from the raw carried-forward day row (still "Blue" — Job
 * Starting Today) instead of the already-computed "Gray" (Continuation).
 *
 * Workflow tier — creates a real Quick Job via the UI, only ever against
 * the in-memory store (see playwright.config.ts).
 */
test("a carried-over job defaults to Gray, not Blue, on its second day", async ({ page }) => {
  await page.goto("/schedule/edit");
  const today = await page.locator('input[name="date"]').first().inputValue();

  await page.getByRole("button", { name: /quick job/i }).click();
  await page.fill('input[name="building_name"]', `QA Regression Building ${Date.now()}`);
  await page.fill('input[name="description"]', "QA carry-over color regression");
  await Promise.all([
    page.waitForURL((u) => u.searchParams.get("project") !== null, { timeout: 10_000 }),
    page.getByRole("button", { name: /create & schedule/i }).click(),
  ]);

  const projectId = new URL(page.url()).searchParams.get("project")!;
  await expect(page.locator('select[name="schedule_color"]')).toHaveValue("Blue");

  const tomorrow = new Date(today + "T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowIso = tomorrow.toISOString().slice(0, 10);

  await page.goto(`/schedule/edit?date=${tomorrowIso}&project=${projectId}`);
  await expect(page.locator('select[name="schedule_color"]')).toHaveValue("Gray");
});
