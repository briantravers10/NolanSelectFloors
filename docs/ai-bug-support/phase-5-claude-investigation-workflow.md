# Phase 5 — Claude Investigation Workflow (Infrastructure, Not Yet Live)

This is infrastructure, not a live automation. Nothing in this phase lets
any process create a branch, write a fix, or open a pull request on its
own. Per the original instructions for this project: "do not enable
automatic production deployments or unrestricted code modifications" and
"wait for my approval before deployment." The piece that's genuinely
missing before any of that *can* go live is a decision only you can make
(see "What's needed to go live," below) — so this phase stops short of it
and documents exactly what's there and what isn't.

## What exists today (Phases 1–4)

- Sentry captures unhandled errors with page/feature, timestamp, stack
  trace (Phase 2).
- Employees can report a bug in plain English, which records who/when/
  which page, and optionally links the last Sentry error that browser tab
  saw (Phase 3).
- The `bug_reports` table already has the columns this workflow needs to
  write into once it's live: `priority`, `admin_notes` (investigation
  notes / proposed fix), `github_pr_url` (Phase 4) — no further schema
  change needed to turn this on later.
- An Owner/Admin can see every report, triage it, and link a PR manually
  once one exists (Phase 4).

## The intended end-to-end flow

1. **Trigger.** An admin clicks "Investigate with AI" on a report in
   `/ai-support` (built this phase — see below), or, once trusted, a High/
   Urgent-priority report triggers it automatically. Either way, this is
   the one point a human (or an explicit policy a human set) decides an
   investigation starts — never silent, never on every report by default.
2. **Context handed to Claude:** the report's description, page, reporter,
   timestamp, and the linked Sentry error (stack trace, breadcrumbs,
   affected route) when one is attached.
3. **Claude reads the relevant code** for that page/route in this
   repository (read-only at this step — no different from how a developer
   would open the files to understand the bug).
4. **Claude proposes a diagnosis** — written back onto the report's
   `admin_notes` field so a human sees the reasoning immediately, before
   any code changes happen.
5. **A new branch, never `main`,** named from the report (e.g.
   `fix/bug-<report-id>-short-slug`), is where any code change happens.
6. **Claude writes a fix, runs the project's existing checks** (`tsc`,
   `eslint`, `next build` — this repo has no automated test suite yet, see
   "Known gap" below) **on that branch only.**
7. **Claude opens a pull request** against `main` from that branch — never
   merges it. The report's `github_pr_url` is set to the PR link
   automatically, so `/ai-support` shows it immediately.
8. **A human reviews and merges (or closes) the PR** through GitHub's
   normal flow, exactly like any other change to this app. Nothing after
   step 7 is automated. Deployment to production only ever happens the way
   it already does today: a merge to `main` triggers Vercel's existing
   production deploy — this workflow does not add a second deployment
   path.

## What's built THIS phase (infrastructure, not automation)

- **"Investigate with AI" button** on each open report in `/ai-support`
  (`components/support/AdminReportRow.tsx` / a new
  `requestAiInvestigationAction`). Clicking it today:
  - Moves the report to **Investigating**.
  - Writes a timestamped note to `admin_notes` recording that an
    investigation was requested, by whom.
  - Logs it to Change History (`logActivity`), so there's an audit trail
    of every investigation request from day one — per the "all future AI
    actions must use secure credentials, limited permissions and audit
    logs" instruction.
  - **Does not** call out to GitHub, does not read Sentry's API, does not
    spawn any process. It's the trigger point wired up and ready, with
    nothing dangerous behind it yet.
- This document, as the design record for what step 2 onward needs.

## What's needed to go live (none of this is set up — needs your decision)

1. **A GitHub credential scoped to only this repository**, with the
   narrowest permission that can still open a PR (contents: write, pull
   requests: write — nothing broader, specifically not admin or org-level
   access). This is separate from any human's personal GitHub login; it
   should be a dedicated token or GitHub App installation you create and
   control, not reused from this session.
2. **A Sentry API read token**, if you want step 2's Sentry context pulled
   in automatically rather than an admin copying a stack trace in by hand
   — same ask as the one still open from Phase 4.
3. **A decision on the trigger**: manual button only (safest, recommended
   to start), or automatic for High/Urgent reports (faster, but means an
   investigation — and a PR — can happen without a human first deciding
   "yes, look into this one").
4. **A decision on where the actual investigation runs** — e.g. a Claude
   Code Remote session spawned per report, or a GitHub Action. This is an
   infrastructure/cost decision as much as a technical one, since each
   investigation is a real Claude session doing real work.
5. **Explicit sign-off** to connect 1–4 together, since that's the step
   that turns "a button that logs a request" into "a process that writes
   code and opens PRs." Per the original instructions, this step pauses
   here for exactly that sign-off rather than assuming it.

## Known gap worth naming

This repository has no automated test suite (no Jest/Vitest/Playwright in
`package.json` — the existing validation convention is manual `tsc` →
`eslint` → `next build`). Step 6 above ("run the project's existing
checks") is honest about running what exists, not a test suite that
doesn't. If tighter automated investigation/fixes are wanted later, adding
real tests for the areas most likely to need AI-proposed fixes would make
Claude's output easier to trust before a human ever looks at the PR —
worth a separate conversation, not assumed as part of this phase.
