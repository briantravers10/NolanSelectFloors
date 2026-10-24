import { existsSync } from "fs";
import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Autonomous QA Testing Agent — see qa/README.md.
 *
 * Tiers, enforced by directory AND by the hard guards below:
 *   qa/tests/readonly/   — navigation + GET only. The only tier that may
 *                           run against production (signed in as the
 *                           read-only QA monitor — see qa/tests/auth.setup.ts).
 *   qa/tests/unit/       — no browser; pure calculation functions.
 *   qa/tests/security/   — no browser; RLS policies exercised in an
 *                           embedded Postgres (PGlite).
 *   qa/tests/workflow/   — creates/edits data. ISOLATED ENVIRONMENTS ONLY.
 *   qa/tests/regression/ — same.
 *
 * HARD GUARDS (requirement: must hold even if env vars are changed by
 * mistake). Two independent checks, both in code, neither overridable
 * by an env var:
 *   1. The write tiers are only registered as Playwright projects at all
 *      when writeTiersAllowed() is true — the target must be
 *      localhost/127.0.0.1, or exactly the URL named in QA_ISOLATED_ENV_URL.
 *      A typo'd QA_BASE_URL, a CI flag, or a workflow edit cannot turn
 *      them on for anything else: there is no project to run.
 *   2. Even then, they depend on the "isolation-check" project
 *      (qa/tests/isolation.check.ts), which probes the target and fails
 *      — taking the write tiers with it — unless the app confirms no
 *      real database is configured behind it (app/api/qa/seed/route.ts
 *      404s whenever one is).
 */
export const baseURL = process.env.QA_BASE_URL || "http://localhost:3000";

export function isLocalhost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function writeTiersAllowed(url: string = baseURL, isolatedUrl: string | undefined = process.env.QA_ISOLATED_ENV_URL): boolean {
  if (isLocalhost(url)) return true;
  // An explicitly isolated environment must be named EXACTLY (scheme,
  // host, port) — a prefix match or a bare hostname is not enough.
  return Boolean(isolatedUrl) && url.replace(/\/$/, "") === isolatedUrl!.replace(/\/$/, "");
}

// Dev-sandbox convenience only: use a preinstalled Chromium if one is at
// this path (this sandbox blocks the Playwright CDN). GitHub Actions has
// no such path and installs its own browser — see .github/workflows/qa.yml.
const localChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(localChromium) ? localChromium : undefined;
const launchOptions = executablePath ? { executablePath } : {};
const browser = { ...devices["Desktop Chrome"], launchOptions };

// Production monitoring signs in as the read-only QA monitor first and
// reuses that session for every readonly test. Only when credentials are
// provided — locally (demo mode, no real auth) there's nothing to sign
// in to, and the readonly tests run as the default demo persona.
const monitorLoginConfigured = Boolean(process.env.QA_MONITOR_EMAIL && process.env.QA_MONITOR_PASSWORD);
const storageState = "qa/results/.auth/monitor.json";

const projects: Project[] = [];

if (monitorLoginConfigured) {
  projects.push({ name: "setup", testMatch: /auth\.setup\.ts/, use: browser });
}

projects.push({
  name: "readonly",
  testDir: "./qa/tests/readonly",
  use: { ...browser, ...(monitorLoginConfigured ? { storageState } : {}) },
  dependencies: monitorLoginConfigured ? ["setup"] : [],
});

projects.push({ name: "unit", testDir: "./qa/tests/unit" });
projects.push({ name: "security", testDir: "./qa/tests/security" });

if (writeTiersAllowed()) {
  projects.push({ name: "isolation-check", testMatch: /isolation\.check\.ts/ });
  projects.push({ name: "workflow", testDir: "./qa/tests/workflow", use: browser, dependencies: ["isolation-check"] });
  projects.push({ name: "regression", testDir: "./qa/tests/regression", use: browser, dependencies: ["isolation-check"] });
}

export default defineConfig({
  testDir: "./qa/tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // shared in-memory store for the write tiers — avoid cross-test races
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
  projects,
});
