import { test as setup, expect } from "@playwright/test";

/**
 * Production monitoring sign-in. Runs once (the "setup" project in
 * playwright.config.ts) when QA_MONITOR_EMAIL/QA_MONITOR_PASSWORD are
 * provided, and saves the resulting session so every readonly test
 * reuses it — exactly one login per run.
 *
 * The monitor is a dedicated, view-only office_users account (see
 * qa/README.md "Production monitoring") whose session is refused any
 * non-GET request at the edge (lib/supabase/middleware.ts). Signing in
 * is the one POST it is allowed to make — the login form is exempt from
 * that block because the block is keyed on an already-authenticated
 * session, which doesn't exist yet at this point.
 */
setup("sign in as the read-only QA monitor", async ({ page }) => {
  const email = process.env.QA_MONITOR_EMAIL!;
  const password = process.env.QA_MONITOR_PASSWORD!;

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // A failed login redirects back to /login?mode=error; a successful one
  // lands on the dashboard with the app shell (and a Sign out button).
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

  await page.context().storageState({ path: "qa/results/.auth/monitor.json" });
});
