# AI Bug Monitoring & Support System — Phase 1 Architecture Notes

Scope: this document is the Phase 1 deliverable only (inspect architecture,
identify integration points, set guardrails). No Sentry, chatbox, or
dashboard code has been written yet — that's Phases 2–4, pending the
decisions and credentials listed under "What I need from you" in the
accompanying report.

## Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- **Hosting**: Vercel, project `nolan-select-floors`. `main` is the
  production branch — every push to `main` auto-deploys to production.
  Any other branch pushed to GitHub also gets an automatic Vercel
  **preview** deployment (separate URL, not production) — this will happen
  for `feature/ai-bug-support` as soon as it's pushed, with no action
  needed to request it, and without affecting the production deployment.
- **Database**: Supabase Postgres (project `fbciqsucmuxdggpjjxrg`), accessed
  through `lib/db.ts`.
- **No CI/CD pipeline**: no GitHub Actions, no automated test suite (no
  Jest/Vitest/Playwright in `package.json`). The existing validation
  convention before every change is manual: `tsc --noEmit` → `eslint` →
  `next build`. There is nothing under "Phase 6: run existing automated
  tests" to run yet — see the Phase 1 report for how this affects that step.
- **Deployment config**: `vercel.json` is minimal (framework + region) —
  no custom build/env wiring to worry about breaking.

## Data layer — dual-mode, already safe for isolated dev

`lib/db.ts` is the single data-access layer every page/action imports from.
Every function in it checks `getSupabaseClient()` first; if no Supabase
project is configured in the environment (no `NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY`), it transparently reads/writes an **in-memory
seed store** (`lib/store.ts`, seeded from `lib/seed-data.ts`) instead.

This means the app already has a built-in "test database" mode with zero
extra setup: running `next dev`/`next build` in this branch's environment
**without** the Supabase env vars set automatically uses mock in-memory data
— satisfying Phase 1 item 9 ("use a separate test database or mocks") with
no new infrastructure. If real Postgres-backed testing is wanted later
(e.g. to test a new `bug_reports` table), that needs a **separate Supabase
project** — not the production one — see "What I need from you."

## Auth & permissions (relevant to Phases 3–4)

- `lib/current-user.ts` resolves the acting user; `OWNER_ACTING_ID` /
  `is_owner` on `office_users` identify unrestricted Owner/Admin access.
- `lib/permissions.ts` is a per-section grid (`SECTION_KEYS` in
  `lib/types.ts`: dashboard, clients, buildings, job_requests, projects,
  schedule, staff, materials, pricing, reports, company_setup,
  quickbooks) with `none`/`view`/`edit` per staff member, set at
  `/company-setup/staff-access`. **Secure by default** — no row means
  `none`.
- Page gating pattern used everywhere: `requireSectionAccess("x")` /
  `canEdit("x")` + `<AccessDenied section="X" />` fallback (see e.g.
  `app/schedule/page.tsx`).

For "AI Support" (Phase 4, admin-only): the simplest, safest option is
gating directly on `is_owner`/`OWNER_ACTING_ID` (same as other
Owner-exclusive areas) rather than adding a new section key to the shared
grid — avoids a schema change to `section_permissions` and keeps the page
inherently Owner/Admin-only without needing anyone to remember to grant
it. Can revisit if you want finer-grained roles on it later.

## Error handling conventions today

There is no centralized error/logging layer yet. The closest existing
things:

- `lib/db.ts#logActivity` — writes to the `activity_log` table (actor,
  action, related record, detail, timestamp) for audit/history purposes.
  Not an error tracker — it logs successful actions, not failures.
  Keeping it separate from Sentry integration (different purpose: business
  audit trail vs. error monitoring) rather than conflating the two.
- A handful of API routes (`app/api/assistant/route.ts`,
  `app/api/inbound/resend/route.ts`) individually `console.error(...)` on
  failure and return a user-facing fallback message — no shared wrapper.

This is exactly what Sentry needs to sit underneath: wrap the existing
try/catch spots and add global handlers, without changing any of the
business logic above.

## Where Sentry would hook in (Next.js App Router convention)

Next.js's current (non-deprecated) pattern for the installed version:
- `instrumentation.ts` (repo root) — server + edge runtime init, calls
  `Sentry.init(...)` for server/edge.
- `instrumentation-client.ts` (repo root) — client-side init.
- `app/global-error.tsx` — catches errors React's own error boundaries
  miss (root layout failures).
- The Sentry Next.js SDK (`@sentry/nextjs`) auto-instruments API routes,
  server actions, and page renders for timestamps, affected
  route/feature, and stack traces once initialized — matching Phase 2
  items 1–6 largely "for free" from the SDK itself, not custom code.
- Source maps: the SDK's build-time plugin needs a Sentry **auth token**
  (org/project-scoped) to upload source maps for readable stack traces —
  this is a secret, needs to go in Vercel env vars (preview-scoped only
  while in this branch), never committed.

## Sensitive-data guardrail (Phase 2 item 7)

Fields that must never reach Sentry: employee pay rates (`daily_rate`,
`hourly_rate`), `project_value`/financial figures, QuickBooks tokens,
Supabase service role key, session cookies, any customer PII beyond what's
already visible in a URL. Sentry's SDK supports `beforeSend`/scrubbing
hooks and has `sendDefaultPii: false` as a safe default — the actual
Sentry.init config (Phase 2) will set this explicitly and redact request
bodies on API routes that touch payroll/financials, rather than relying on
defaults alone.

## Proposed new tables (Phase 3, NOT created yet)

For employee bug reports, a new `bug_reports` table (mirroring the
existing `activity_log`/`inbound_emails` patterns — `company_id` scoped,
`created_by`/`created_at`, a `status` enum) is the natural fit, plus
optionally a `sentry_error_id` nullable column to cross-link an
auto-detected Sentry issue to a human report of the same bug. This needs
an actual migration against a real Postgres database — **not applied to
production** per your instructions, and not run anywhere until you confirm
the test-database approach (see report).
