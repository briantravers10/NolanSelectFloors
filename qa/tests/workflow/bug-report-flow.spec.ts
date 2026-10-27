import { test, expect } from "@playwright/test";

/** Workflow tier — the employee-facing "Report a Problem" → admin
 * "AI Support" pipeline (the system this QA agent itself reports into —
 * see qa/lib/report-finding.ts) actually works end to end. */
test("a submitted bug report appears on the AI Support dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /report a problem/i }).click();
  const marker = `QA workflow test ${Date.now()}`;
  await page.fill("textarea[name=description]", marker);
  await page.getByRole("button", { name: /send report/i }).click();
  await expect(page.getByText(marker)).toBeVisible({ timeout: 10_000 });

  await page.goto("/ai-support");
  await expect(page.getByText(marker)).toBeVisible();
});
