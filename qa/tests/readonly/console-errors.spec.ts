import { test, expect } from "@playwright/test";

/** Read-only tier — flags any uncaught JS exception, or any request that
 * failed/404'd, on the pages people actually live in day to day. Not
 * exhaustive (every page in pages-load.spec.ts), just the highest-traffic
 * ones, to keep this fast to run twice a day. */
const HIGH_TRAFFIC_PAGES = ["/dashboard", "/schedule", "/projects", "/staff", "/inbox", "/payroll"];

for (const path of HIGH_TRAFFIC_PAGES) {
  test(`no JS errors or failed requests: ${path}`, async ({ page }) => {
    const jsErrors: string[] = [];
    const badRequests: string[] = [];

    page.on("pageerror", (err) => jsErrors.push(err.message));
    page.on("response", (res) => {
      // favicon.ico is a known, harmless, pre-existing gap — not an app
      // regression this suite should flag.
      if (res.status() >= 400 && !res.url().endsWith("/favicon.ico")) badRequests.push(`${res.status()} ${res.url()}`);
    });

    await page.goto(path, { waitUntil: "networkidle" });

    expect(jsErrors, `JS errors on ${path}:\n${jsErrors.join("\n")}`).toHaveLength(0);
    expect(badRequests, `failed requests on ${path}:\n${badRequests.join("\n")}`).toHaveLength(0);
  });
}
