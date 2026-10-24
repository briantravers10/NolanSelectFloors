import { test, expect } from "@playwright/test";

/**
 * Read-only tier (see playwright.config.ts) — every major page a signed-in
 * user can reach, verified to load without a 5xx or a client-side crash.
 * Safe against production: GET navigation only, no form submission, no
 * button click that could mutate anything.
 */
const PAGES = [
  "/dashboard",
  "/job-requests",
  "/job-requests/new",
  "/clients",
  "/buildings",
  "/projects",
  "/schedule",
  "/schedule/weekly",
  "/schedule/friday-review",
  "/meetings",
  "/staff",
  "/staff/time-off",
  "/materials",
  "/suppliers",
  "/drawings",
  "/pricing",
  "/inbox",
  "/purchase-orders",
  "/bids",
  "/reports",
  "/payroll",
  "/agenda",
  "/company-setup",
  "/company-setup/staff-access",
  "/ai-support",
  "/qa",
];

for (const path of PAGES) {
  test(`loads without a server error: ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response, `no response for ${path}`).toBeTruthy();
    expect(response!.status(), `${path} returned ${response!.status()}`).toBeLessThan(500);
    // Against production this must be the real page, not a redirect to
    // /login — otherwise the check is only testing the login screen.
    expect(new URL(page.url()).pathname, `${path} redirected to the login page`).not.toMatch(/^\/login/);
  });
}
