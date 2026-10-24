import { existsSync } from "fs";
import { defineConfig, devices } from "@playwright/test";

// Dev-sandbox convenience only: if a Chromium binary is already sitting at
// the path this environment preinstalls it to, use it directly instead of
// trying to download one (this sandbox's network blocks the Playwright
// CDN). Does nothing on GitHub Actions, which has no such path and
// installs its own browser via `playwright install --with-deps` — see
// .github/workflows/qa.yml.
const localChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(localChromium) ? localChromium : undefined;

/**
 * Autonomous QA Testing Agent — see qa/README.md.
 *
 * Two test tiers, enforced by directory, never by convention alone:
 *   qa/tests/readonly/  — navigation + GET requests only. Safe to point at
 *                          production (QA_BASE_URL=https://nolan-select-floors.vercel.app).
 *   qa/tests/workflow/   — creates/edits data (quick jobs, filing email,
 *                          submitting bug reports). The CI workflow NEVER
 *                          points this tier at a URL with real Supabase
 *                          credentials behind it — see .github/workflows/qa.yml,
 *                          which starts the app locally with no Supabase
 *                          env vars set, so lib/db.ts's dual-mode falls
 *                          back to the in-memory seed store automatically.
 *                          Nothing this tier does can reach production data.
 */
const baseURL = process.env.QA_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./qa/tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared in-memory store for the workflow tier — avoid cross-test races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["json", { outputFile: "qa/results/results.json" }]],
  outputDir: "qa/results/artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} },
    },
  ],
});
