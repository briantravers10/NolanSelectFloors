import { test, expect } from "@playwright/test";

/**
 * Read-only tier — crude but useful page-load budget, and a flag for
 * pages making a suspiciously large number of requests (the inbox
 * pagination bug fixed earlier was exactly this: one page firing a
 * signed-URL request per attachment across a 326-item unpaginated list).
 * Not a replacement for real APM — see Vercel/Sentry for that — just an
 * early warning a budget regressed.
 */
const BUDGETED_PAGES: { path: string; maxMs: number; maxRequests: number }[] = [
  { path: "/dashboard", maxMs: 8000, maxRequests: 80 },
  { path: "/schedule", maxMs: 8000, maxRequests: 80 },
  { path: "/inbox", maxMs: 10000, maxRequests: 120 },
  { path: "/projects", maxMs: 8000, maxRequests: 80 },
  { path: "/payroll", maxMs: 8000, maxRequests: 80 },
];

for (const { path, maxMs, maxRequests } of BUDGETED_PAGES) {
  test(`loads within budget: ${path}`, async ({ page }) => {
    let requestCount = 0;
    page.on("request", () => requestCount++);

    const start = Date.now();
    await page.goto(path, { waitUntil: "networkidle" });
    const elapsed = Date.now() - start;

    expect(elapsed, `${path} took ${elapsed}ms (budget ${maxMs}ms)`).toBeLessThan(maxMs);
    expect(requestCount, `${path} made ${requestCount} requests (budget ${maxRequests})`).toBeLessThan(maxRequests);
  });
}
