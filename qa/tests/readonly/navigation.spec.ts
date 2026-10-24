import { test, expect } from "@playwright/test";

/** Read-only tier — the sidebar/nav actually gets you where it says it
 * will. Clicking a Link is navigation, never a mutation. */
test("sidebar links navigate to their pages", async ({ page }) => {
  await page.goto("/dashboard");
  const checks: { label: string; href: string }[] = [
    { label: "Schedule", href: "/schedule" },
    { label: "Projects", href: "/projects" },
    { label: "Staff", href: "/staff" },
    { label: "Materials", href: "/materials" },
  ];
  for (const { label, href } of checks) {
    await page.goto("/dashboard");
    await page.locator(`aside a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(href.replace(/\//g, "\\/")));
  }
});

test("mobile More menu opens and lists sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /more/i }).click();
  await expect(page.getByText("All sections")).toBeVisible();
});
