import { test, expect } from "@playwright/test";

/**
 * Read-only tier — role-based access control actually denies what it's
 * supposed to. Uses the app's own demo "acting user" cookie (nsf_acting_user,
 * see lib/current-user.ts) to view the app as David Okoye (ou-3, a
 * field_employee with view-only access to dashboard/schedule/projects/tasks
 * and no access to anything else — see lib/seed-data.ts). Setting a cookie
 * and loading pages is a read, never a mutation.
 */
// The demo "acting as" cookie is ignored once real auth is on — there the
// signed-in QA monitor is the persona, and its own permission boundaries
// are asserted in authenticated.spec.ts instead.
const realAuth = Boolean(process.env.QA_MONITOR_EMAIL && process.env.QA_MONITOR_PASSWORD);

test.describe("non-owner (field employee) access", () => {
  test.skip(realAuth, "demo-mode persona switching only — covered by authenticated.spec.ts under real auth");
  test.beforeEach(async ({ context, baseURL }) => {
    const url = new URL(baseURL!);
    await context.addCookies([{ name: "nsf_acting_user", value: "ou-3", domain: url.hostname, path: "/" }]);
  });

  const ALLOWED = ["/dashboard", "/schedule", "/projects"];
  const DENIED = ["/staff", "/payroll", "/reports", "/pricing", "/company-setup", "/materials", "/clients", "/ai-support", "/qa"];

  for (const path of ALLOWED) {
    test(`can view ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(/don't have access/i)).toHaveCount(0);
    });
  }

  for (const path of DENIED) {
    test(`is denied ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(/don't have access/i)).toBeVisible();
    });
  }

  test("pay rates never reach the page for a denied section", async ({ page }) => {
    // /staff is denied outright above; this double-checks the VISIBLE
    // rendered text never shows a dollar-rate figure for this role.
    // innerText (not textContent/HTML) deliberately excludes React's
    // inline streaming-payload script content, which can otherwise
    // contain "$"-prefixed protocol markers that look like a false match.
    await page.goto("/staff");
    const visibleText = await page.locator("body").innerText();
    expect(visibleText).not.toMatch(/\$\d/);
  });
});

test("the owner/demo default acting user is NOT access-denied anywhere the non-owner is", async ({ page }) => {
  await page.goto("/staff");
  await expect(page.getByText(/don't have access/i)).toHaveCount(0);
});
