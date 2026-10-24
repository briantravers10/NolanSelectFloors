# Autonomous QA Testing Agent

Built per the "Build an Autonomous QA Testing Agent" request, then
revised per a follow-up safety/coverage review — see the chat where both
were scoped. This file is the design doc and operating manual.

## 1. What actually happens today when an employee reports a bug

Audited directly against the code (`app/support/actions.ts`,
`app/ai-support/page.tsx`) rather than assumed. Exactly this, and nothing
more:

1. An employee clicks "Report a Problem" anywhere in the app, types a
   description, and submits (`submitBugReportAction`).
2. A row is written to `bug_reports` with `status: "Open"`, and an email
   goes to the configured recipient (`sendEmail`, `app/support/actions.ts`).
3. An Owner/Admin sees it on `/ai-support`, with a button labeled
   "✨ Investigate with AI".
4. Clicking that button calls `requestAiInvestigationAction`. Reading
   that function's actual body: it sets `status` to `"Investigating"` and
   appends one hardcoded sentence to `admin_notes`:
   *"Automated investigation isn't wired up yet (Phase 5 infrastructure
   only)..."*. **That is the entire effect of the button.** It does not
   read code, does not call Claude or any other model, does not look at
   the report, does not propose a diff, and does not open a PR.

**What's missing** for the request's description of "an AI agent that
receives bug reports, investigates problems, prepares a fix plan, and
waits for approval" to be real:

- A trigger that starts an investigation session when a report comes in
  (nothing currently starts one — a human has to separately open Claude
  Code and ask it to look at `/ai-support`, same as happened twice this
  week for the two real bugs that got fixed).
- A credential for that session to read/write this repo (scoped to this
  repo only, ideally) and open PRs on its own.
- Somewhere for it to post back a fix plan / PR link for approval — the
  `github_pr_url` / `admin_notes` fields on `bug_reports` already exist
  and already render on `/ai-support` for exactly this, but nothing
  writes to them automatically today.
- An explicit decision from you about how much autonomy that session
  gets (an earlier attempt this week to set up a recurring, unattended,
  permission-free trigger was refused by this environment's own safety
  classifier — "Create Unsafe Agents" — so this is a real open question,
  not a trivial wiring task).

This QA agent integrates with the **real** thing that exists — the
`bug_reports` table and `/ai-support` dashboard, filing findings exactly
the way an employee's own report would — not the automated
investigate-and-fix pipeline described in the request, which doesn't
exist yet. Building that pipeline is a separate, later piece of work.

## 2. Architecture

### Two Playwright tiers, enforced by directory

- **`qa/tests/readonly/`** — navigation + GET requests only, nothing that
  could mutate data (now including role-based access checks, which only
  read a cookie and a page — see `permissions.spec.ts`).
- **`qa/tests/workflow/`** and **`qa/tests/regression/`** — creates/edits
  data (Quick Jobs, filing email, submitting bug reports, filing bids).
- **`qa/tests/unit/`** — no browser at all; calls the actual calculation
  functions (`lib/payroll.ts`, `lib/labor-cost.ts`) directly with
  synthetic data. The right tool for payroll correctness specifically —
  precise and fast, with none of a browser test's incidental flakiness.

### Two GitHub Actions jobs, never mixed (the safety fix from review)

- **`production-monitor`** — runs **only** `qa/tests/readonly`, against
  the real live app (`QA_BASE_URL` = production). Fires on the
  twice-daily schedule and on manual dispatch. **Never** fires on a pull
  request, and the workflow/regression/unit tiers never run in this job
  — there is no code path in it that could mutate production data, not
  just a convention that it doesn't.
- **`full-suite`** — runs everything (unit + readonly + workflow +
  regression), against the app started **locally on the GitHub Actions
  runner** with no Supabase credentials in its environment at all, so
  `lib/db.ts`'s dual-mode data layer falls back to the in-memory seed
  store automatically — the same mechanism every Vercel preview
  deployment already relies on. Fires on every pull request targeting
  `main` (main auto-deploys, so this is the practical "before it reaches
  production" gate) and on manual dispatch. **Never** fires on the
  schedule, and never points at a URL with real credentials behind it.

The "Run QA Tests Now" button (`/qa`) dispatches `workflow_dispatch`,
which runs **both** jobs — a comprehensive on-demand check.

### The core safety mechanism — reused, not invented

The app already has a dual-mode data layer (`lib/db.ts#sb`): every read/
write checks for Supabase credentials first, and transparently falls
back to an in-memory seed store when none are configured. `full-suite`
starts the app with no such credentials, so there is no credential for
the workflow/regression tier to misuse even if an AI instruction or bug
told it to — it structurally cannot reach production data.

A small QA-only endpoint, `app/api/qa/seed/route.ts`, lets tests set up
scenarios the UI can't quickly create. It 404s immediately if a real
Supabase project is configured.

### Credential model for writing results (revised after review)

**No Supabase service-role key is used anywhere in this workflow.**
`qa/lib/report-results.mjs` — the only thing that writes to production —
uses the **public anon key** (the same `NEXT_PUBLIC_SUPABASE_ANON_KEY`
value the app's own client bundle already ships; not a secret), and is
restricted entirely by Postgres Row-Level Security policies:

- `qa_test_runs` / `qa_findings` (migration `0039`): this key may insert,
  update, and select — nothing sensitive lives in either table (test
  names, page paths, counts, generic error text).
- `bug_reports` (migration `0040`): this key may **only insert**, and
  **only** a row where `reported_by_user_id = 'qa-agent'`. There is no
  select, update, or delete policy for it on this table **at all** — it
  cannot read any report (QA-filed or human-filed), cannot change
  `status`/`admin_notes`/`priority` on anything, and cannot touch an
  existing row in any way. This is enforced by Postgres itself, not by
  this branch's code — even a future bug in `report-results.mjs` that
  tried to read or edit a `bug_reports` row with this key would be
  refused by the database.

This is a genuine restriction, not a scoped-by-convention promise: if
this key leaked, the worst it can do is insert low-value rows into two
operational tables and file spurious bug reports — it cannot read a
customer's data, a pay rate, or any other report, and cannot modify or
delete anything that exists.

## 3. Schedule

Four UTC cron firings a day; a `should-run` gate checks the actual
`America/New_York` clock and only lets the relevant job proceed at real
local 8am/8pm, so it self-corrects across DST without the file ever
needing an edit. `production-monitor` runs then; `full-suite` runs on
pull requests and on demand instead.

## 4. Coverage

Built this round: page-load/console-and-network-error/performance smoke
tests across every major page; nav-link checks; role-based access
control (an unprivileged demo user is denied the pages it should be,
and never sees a pay-rate figure); payroll calculation correctness as
direct unit tests (hourly, daily-rate proportional splitting across
same-day jobs, the schedule-fallback-before-confirmation path, the
double-booking-still-one-day-rate rule, tax-status grouping); the two
real bugs fixed earlier this week as permanent regression tests (Inbox
pagination, schedule carry-over color); Quick Job creation; Report a
Problem → AI Support; inbox filing; bid filing and its duplicate-filing
invariant; QuickBooks's disconnected-state health (its real testable
surface today — no fake "connected" state is simulated, per the app's
own "never fake success" principle already in `lib/seed-data.ts`).

**A real finding from writing the payroll tests, flagged for a product
decision rather than silently "fixed":** `time_and_half` only affects
the *planned* `schedule_assignments.assignment_cost` figure
(`createScheduleAssignment`, `lib/db.ts`), used as payroll's fallback
*before* hours are confirmed. Once real hours are confirmed
(`createActualLaborEntry`), the entry only snapshots the employee's
plain `hourly_rate`/`daily_rate` — the 1.5× multiplier is never carried
over into confirmed payroll. `qa/tests/unit/payroll.spec.ts` pins this
down as current, tested behavior so a future change to it is deliberate.
Whether confirmed hours *should* also apply time-and-half is a business
question for you, not something this QA pass changed.

**Still not covered**: estimate-to-invoice linking depth beyond basic
bid filing, QuickBooks sync *with* a real/sandboxed connection (not
achievable without real or sandboxed OAuth credentials), job-number
uniqueness under concurrent creation. Per "gradually improve coverage,"
the plan stays the same as the two regression tests already added: when
a real bug is found and fixed, it gets a permanent test here.

## 5. Will the dashboard, schedule, and "Run Now" button actually work after deployment?

Walked through directly against the code, not assumed:

- **`/qa` dashboard** — `listQaTestRuns`/`listQaFindings` follow the
  exact same pattern as every other dual-mode read in `lib/db.ts`: if
  Supabase is configured but the query errors (e.g. the table doesn't
  exist yet because migration `0039` isn't applied), it falls through to
  the in-memory store and returns an empty list rather than crashing —
  this is the same proven pattern `bug_reports` used before `0038` was
  applied, and it worked. **So: merging this branch before the migration
  runs is safe — the dashboard just shows an empty state until then.**
- **Scheduled runs** — once this merges to `main`, the cron schedule
  starts firing on its own; GitHub only needs the workflow file to exist
  on the default branch, nothing else. `production-monitor` will start
  actually testing the live app immediately. It just won't be able to
  *write* results to `/qa` until `SUPABASE_URL`/`SUPABASE_ANON_KEY` are
  added as repo secrets — until then, results are visible in the GitHub
  Actions run log only (the step is designed to degrade this way, not
  fail).
- **"Run QA Tests Now" button** — calls GitHub's `workflow_dispatch` API
  for `qa.yml` on `ref: main`. This can only succeed once the workflow
  file exists on `main` — i.e. **after this PR merges**, not before.
  Before that (or before `QA_GITHUB_DISPATCH_TOKEN` is set), it shows a
  clear "not configured" / "GitHub declined the request" message instead
  of silently failing — already built and covered by
  `components/qa/RunQaTestsButton.tsx`.

## 6. Setup required before this is fully live

1. **Apply `supabase/migrations/0039_qa_tracking.sql` and
   `0040_qa_agent_bug_report_policy.sql`** to production, in that order.
2. **GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (the
   public anon key — not sensitive, but kept as a secret for tidiness;
   see "Credential model" above for exactly what it can do).
3. **`QA_GITHUB_DISPATCH_TOKEN`** (Vercel env var) — a GitHub PAT scoped
   to `Actions: write` on this repo only, for the "Run QA Tests Now"
   button.
4. Optional: a `QA_PRODUCTION_URL` repository variable, if the
   production URL ever changes — defaults to
   `https://nolan-select-floors.vercel.app` otherwise.

None of the above blocks merging this branch — the app, dashboard, and
test suite all work today without any of it; they just show empty
states / clear "not configured" messages, and `production-monitor`
simply won't persist results anywhere but the Actions log, until it's
set up.
