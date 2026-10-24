import { test, expect } from "@playwright/test";

/**
 * Read-only tier — proves production monitoring is actually looking at
 * the authenticated app, not the login screen, and that the monitor's
 * session is refused any write. Only meaningful when signed in as the
 * QA monitor (QA_MONITOR_EMAIL set — see qa/tests/auth.setup.ts); in
 * local demo mode there is no login to get past, so these skip.
 */
const monitorConfigured = Boolean(process.env.QA_MONITOR_EMAIL && process.env.QA_MONITOR_PASSWORD);
test.skip(!monitorConfigured, "QA monitor credentials not configured — nothing to sign in to");

const AUTHENTICATED_PAGES = ["/dashboard", "/schedule", "/schedule/weekly", "/projects", "/staff", "/materials", "/clients", "/buildings", "/job-requests"];

for (const path of AUTHENTICATED_PAGES) {
  test(`signed-in monitor reaches the real page: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).not.toMatch(/^\/login/);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    // The app shell, not a standalone page.
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
    await expect(page.getByText(/don't have access/i)).toHaveCount(0);
  });
}

test("signed-in monitor can navigate between sections like a user would", async ({ page }) => {
  await page.goto("/dashboard");
  await page.locator('aside a[href="/schedule"]').first().click();
  await expect(page).toHaveURL(/\/schedule/);
  await page.locator('aside a[href="/projects"]').first().click();
  await expect(page).toHaveURL(/\/projects/);
});

test("the monitor's session is refused any write at the edge (403 on POST, before app code runs)", async ({ page }) => {
  // No action id, no body — nothing could execute even without the block;
  // this probes the block itself. Every Server Action and form submit in
  // this app is a POST, so a 403 here means none of them can run.
  const res = await page.request.post("/dashboard", { data: "", maxRedirects: 0 });
  expect(res.status()).toBe(403);
  const res2 = await page.request.post("/schedule/edit", { data: "", maxRedirects: 0 });
  expect(res2.status()).toBe(403);
});

test("the monitor is not an Owner/Admin (owner-only pages are denied)", async ({ page }) => {
  await page.goto("/ai-support");
  await expect(page.getByText(/don't have access/i)).toBeVisible();
  await page.goto("/company-setup/staff-access");
  await expect(page.getByText(/don't have access/i)).toBeVisible();
});

test("the monitor never sees a pay-rate figure", async ({ page }) => {
  await page.goto("/staff");
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/\$\d/);
});
