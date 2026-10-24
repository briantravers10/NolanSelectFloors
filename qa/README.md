# Autonomous QA Testing Agent

Built per the "Build an Autonomous QA Testing Agent" request — see the
chat where this was scoped. This file is both the design doc and the
operating manual.

## What actually exists today (audit findings)

Before this branch, the repo had **no test framework, no CI, and no
GitHub Actions at all** (`package.json` had no `@playwright/test`, no
`test` script, and `.github/` didn't exist). The "existing AI
bug-fixing agent" referenced in the request is the **Report a
Problem → AI Support** system built earlier (`app/support/actions.ts`,
`app/ai-support/page.tsx`, `bug_reports` table): employees file a
report, an Owner/Admin sees it on `/ai-support` and gets an email.
**There is no autonomous agent that investigates and proposes fixes on
its own today** — the "Investigate with AI" button on that dashboard is
an explicit placeholder (see `requestAiInvestigationAction` in
`app/support/actions.ts`) that logs a note and nothing else; a human
(asking Claude Code) still has to drive every actual fix. This QA agent
integrates with the **real** thing that exists — the `bug_reports`
table and dashboard — not an automated fix pipeline that doesn't exist
yet, per the instruction not to invent an integration.

## Architecture

Two test tiers, enforced by directory (`playwright.config.ts`):

- **`qa/tests/readonly/`** — navigation + GET requests only, nothing that
  could mutate data. Safe to point at **production**
  (`QA_BASE_URL=https://nolan-select-floors.vercel.app`): page loads,
  console errors, nav links, performance/request-count budgets.
- **`qa/tests/workflow/`** and **`qa/tests/regression/`** — creates/edits
  data (quick jobs, filing email, submitting bug reports). The CI
  workflow **never** points this tier at anything with real Supabase
  credentials behind it.

### The core safety mechanism — reused, not invented

The app already has a dual-mode data layer (`lib/db.ts#sb`): every read/
write checks for Supabase credentials first, and transparently falls
back to an **in-memory seed store** when none are configured — this is
what makes every Vercel preview deployment safe today. The QA workflow
starts the app **locally on the GitHub Actions runner** with no
Supabase env vars set at all, so the workflow/regression tier runs
against that in-memory store automatically. There is no code path in
this branch that gives the workflow tier a way to reach production data
— it isn't credentialed to, full stop, independent of what any test or
AI instruction tells it to do.

A small QA-only endpoint, `app/api/qa/seed/route.ts`, lets tests set up
scenarios the UI can't quickly create (e.g. a 30-item unfiled-email
backlog for the Inbox pagination regression test). It 404s immediately
if a real Supabase project is configured — i.e. it is unreachable in
any environment where it could possibly touch real data.

### What writes to production

Exactly one thing: `qa/lib/report-results.mjs`, run once per CI job
after the tests finish, using a Supabase **service-role key** (a GitHub
Actions secret) to write the *results* of the run — `qa_test_runs`,
`qa_findings`, and (for genuinely new failures) a row in the existing
`bug_reports` table — so you can see QA findings on `/qa` and
`/ai-support` without logging into GitHub. It never touches any other
table. See "Setup required" below for the real caveat: a Supabase
service-role key is not a table-scoped credential, so this is a
credential to protect carefully, not a cryptographic guarantee.

## Schedule

`.github/workflows/qa.yml` fires on a UTC cron four times a day; a
`should-run` gate checks the actual `America/New_York` clock and only
lets the job proceed at real local 8am/8pm, so it self-corrects across
DST without ever needing the file edited twice a year. Also fires on
every pull request targeting `main` (main auto-deploys to production,
so this is the practical "before it reaches production" gate — there's
no Vercel deployment-blocking check wired up, since that's a separate
GitHub branch-protection setting; see "Setup required"), and on demand
via `workflow_dispatch` (what the dashboard's "Run QA Tests Now" button
calls).

## Coverage today vs. the full request

Built: page-load/console-error/performance smoke tests across every
major page, nav-link checks, the two real bugs fixed earlier this week
as permanent regression tests (Inbox pagination, schedule carry-over
color), and workflow tests for Quick Job creation, Report a
Problem → AI Support, and inbox filing.

**Not yet covered** (the request's A–H list is large — this is a real
starting suite, not the full matrix): payroll overtime/split-hours
calculations, QuickBooks sync health, estimate/invoice linking,
authentication/role-based access denial paths, and duplicate-job-number
detection. Per item 8 of the request ("gradually improve coverage based
on recurring bugs"), the natural way this grows is the same pattern
already used twice: when a real bug is found and fixed, its regression
test gets added here.

## Setup required before this is fully live

1. **Apply `supabase/migrations/0039_qa_tracking.sql`** — not applied
   yet (same convention as `0038_bug_reports.sql`). Until it is, `/qa`
   works and shows an empty state; it just has nothing to show.
2. **GitHub Actions secrets**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   — needed for `report-results.mjs` to write run history and file bug
   reports. Without these, tests still run and their pass/fail is
   visible in the GitHub Actions log, but nothing reaches `/qa` or
   `/ai-support`.
3. **`QA_GITHUB_DISPATCH_TOKEN`** (Vercel env var) — a GitHub PAT scoped
   to Actions:write on this repo only, used by the "Run QA Tests Now"
   button (`app/qa/actions.ts`). Without it, the button shows a clear
   "not configured" message instead of failing silently.
4. A Supabase **service-role key is a repo-wide credential** (it bypasses
   RLS for everything, not just the QA tables) — worth knowing before
   approving it as a GitHub secret, even though every code path that
   uses it in this branch only touches `qa_test_runs`, `qa_findings`,
   and `bug_reports`.

None of the above blocks merging this branch — the app, the dashboard,
and the test suite all work without any of it; they just show empty
states / clear "not configured" messages until it's set up.
