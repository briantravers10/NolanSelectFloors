import { test, expect } from "@playwright/test";

/**
 * Read-only tier — QuickBooks integration health in its disconnected
 * state (no sandbox/live QuickBooks credentials exist in the isolated
 * test environment, and per the app's own "never fake success" principle
 * — see lib/seed-data.ts's QuickBooks section — this suite does not
 * fabricate a fake connected state either). What's actually testable
 * without real OAuth: the settings page and API routes behave correctly,
 * with no crash, when nothing is connected.
 */
test("QuickBooks settings page loads and shows a disconnected state without crashing", async ({ page }) => {
  const response = await page.goto("/company-setup/quickbooks");
  expect(response!.status()).toBeLessThan(500);
  // Demo persona (Owner) sees the Connect button; the read-only QA monitor
  // has no QuickBooks access by design and sees the access-denied state.
  // Either is the correct, non-crashing outcome — a login redirect is not.
  expect(new URL(page.url()).pathname).not.toMatch(/^\/login/);
  await expect(page.getByRole("button", { name: /connect quickbooks/i }).or(page.getByText(/don't have access/i))).toBeVisible();
});

test("QuickBooks sync log page loads without a server error", async ({ page }) => {
  const response = await page.goto("/company-setup/quickbooks/sync-log");
  expect(response!.status()).toBeLessThan(500);
});

test("QuickBooks callback route fails cleanly (not a 500) with no real OAuth state", async ({ request }) => {
  const response = await request.get("/api/quickbooks/callback", { maxRedirects: 0 }).catch((e) => e);
  // Either a redirect (3xx) back into the app with an error message, or a
  // 4xx for the missing/invalid state param — never a 500 crash.
  const status = "status" in response ? response.status() : 0;
  expect(status, `unexpected callback status ${status}`).toBeGreaterThan(0);
  expect(status).toBeLessThan(500);
});
