import { test, expect } from "@playwright/test";
import { baseURL, isLocalhost } from "../../playwright.config";

/**
 * Second hard guard for the write tiers (see playwright.config.ts for the
 * first). The workflow and regression projects DEPEND on this project, so
 * if it fails they never start. It asks the target whether it is isolated:
 * app/api/qa/seed/route.ts answers only when the app is running on its
 * in-memory store, and 404s against any real Supabase project. Nothing an
 * env var can change makes a real-database target pass this.
 */
test("target confirms it is an isolated environment with no real database", async ({ request }) => {
  const res = await request.post("/api/qa/seed", { data: { action: "probe" } });
  const body = (await res.json().catch(() => null)) as { isolated?: boolean } | null;
  expect(
    res.status() === 200 && body?.isolated === true,
    `REFUSING to run write-capable tests: ${baseURL} did not confirm it is isolated (status ${res.status()}). ` +
      `A real database appears to be configured behind it${isLocalhost(baseURL) ? " — check the environment the app was started with" : ""}.`
  ).toBe(true);
});
