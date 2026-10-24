# Autonomous QA Testing Agent

Design doc + operating manual. Built per the original request, revised
after two review rounds (see the chat). Every claim below about
production was verified read-only against the live project, and every
security control has an automated test in this repo that runs on every
pull request.

## 1. What happens today when an employee reports a bug

Audited directly against `app/support/actions.ts` and
`app/ai-support/page.tsx`:

1. An employee clicks "Report a Problem", types a description, submits.
2. A `bug_reports` row is written (`status: "Open"`) and an email goes
   to the configured recipient.
3. An Owner/Admin sees it on `/ai-support`, with a "✨ Investigate with
   AI" button.
4. That button (`requestAiInvestigationAction`) sets `status` to
   `"Investigating"` and appends one hardcoded sentence to
   `admin_notes`. **That is its entire effect.** It reads no code, calls
   no model, proposes no fix, opens no PR.

**Missing** for the "investigates and proposes a fix for approval" agent
described in the request: a trigger that starts an investigation when a
report arrives; a repo-scoped credential for it to open PRs; and a
decision on how much autonomy it gets (an earlier attempt to set up a
recurring unattended trigger was refused by this environment's own
safety classifier). This QA agent integrates with what exists — the
`bug_reports` table and `/ai-support` — filing findings exactly as an
employee's report would. The automated-fix pipeline is separate, later
work.

## 2. Identities (two, deliberately separate)

| | QA **results writer** | QA **monitor** |
|---|---|---|
| What it is | A Supabase Auth user, **no** `office_users` row — cannot log into the app at all | A Supabase Auth user **with** a view-only `office_users` row (`is_owner=false`, `access_role=field_employee`) |
| Used by | `qa/lib/report-results.mjs` after each CI run | `production-monitor` job, via the real `/login` form |
| Can do | Insert/update/select `qa_test_runs`, `qa_findings`; **insert only** a `bug_reports` row tagged `reported_by_user_id='qa-agent'` | GET pages its section grants allow (dashboard, schedule, projects, staff, materials, clients, buildings, job requests, reports) |
| Cannot do | Read/update/delete any bug report; touch any other table | Any non-GET request (403 at the edge); owner-only pages; pay-rate figures (`field_employee` tier) |
| Enforced by | Postgres RLS — `supabase/migrations/0039`, `0040` | `lib/supabase/middleware.ts` + `lib/qa-monitor.ts` (API layer), plus the existing `canEdit()` gating on every mutating Server Action |
| Secret held by | GitHub Actions: `QA_RESULTS_WRITER_EMAIL/_PASSWORD` | GitHub Actions: `QA_MONITOR_EMAIL/_PASSWORD`; Vercel: `QA_MONITOR_EMAIL` |

### Why this and not anon-key RLS or a service-role key

The previous design granted policies to the `anon` role. The anon key
is public (it ships in the app's client bundle), so "anyone with the
key" meant anyone — forged runs, rewritten history, fake reports. A
service-role key bypasses RLS entirely and can't be scoped. The results
writer instead holds an ordinary `authenticated` token **minted by
Supabase itself** on password login; what the policies check is one
claim Supabase embeds in every access token, `app_metadata.qa_role`.
`app_metadata` can only be set with the Admin API / dashboard / SQL —
never by the user — so the claim can't be self-assigned (tested:
putting it in `user_metadata` is refused). Nothing custom is signed, so
no JWT-secret handling and no dependency on which signing scheme the
project uses.

Verified read-only on the live project before implementing: `auth.jwt()`,
`auth.uid()`, the `anon`/`authenticated`/`authenticator` roles exist;
**every one of the 50 public tables has RLS enabled with zero policies**,
so an `authenticated` identity inherits nothing anywhere else; 7 real
staff accounts exist and `NSF_REAL_AUTH_ENABLED` is on (`/dashboard`
redirects to `/login`).

### Why the monitor's write block is at the API layer, not the database

The app's own data layer talks to Postgres with the service-role key on
behalf of every user, so per-user database enforcement isn't possible
without re-architecting the app. The hard stop is therefore the HTTP
API layer: every Server Action and form submit in this app arrives as a
POST, and the middleware refuses any non-GET from the monitor's session
with 403 **before any page, action or route code runs**. Underneath it,
independently, the account is view-only so every mutating action's own
`canEdit()` check refuses too, and `markNavSectionSeen` is a no-op for
it so even viewing a page writes nothing. During the validated
signed-in run, the mock API recorded **zero write attempts**.

## 3. Test tiers and the two hard isolation guards

| Tier | Browser | Where it may run |
|---|---|---|
| `qa/tests/readonly/` | yes | anywhere, incl. production (signed in as the monitor) |
| `qa/tests/unit/` | no | anywhere |
| `qa/tests/security/` | no — embedded Postgres (PGlite) | anywhere |
| `qa/tests/workflow/`, `qa/tests/regression/` | yes | **isolated environments only** |

Both guards are in code (`playwright.config.ts`, `qa/tests/isolation.check.ts`)
— no env var enables the write tiers against a real database:

1. The write tiers are only **registered as Playwright projects** when
   the target is `localhost`/`127.0.0.1`, or exactly the URL in
   `QA_ISOLATED_ENV_URL`. Otherwise there is no project to run. Verified:
   `--list` with the production URL shows no workflow/regression projects.
2. Even then they **depend on** `isolation-check`, which asks the app
   whether it's isolated. `app/api/qa/seed/route.ts` answers only when
   running on the in-memory store and 404s whenever any Supabase project
   is configured. Verified: pointed at a server with a configured
   database, the probe failed and all write tests "did not run".

The workflow file adds a third, earlier stop (fails if the full-suite
job has a non-local target or any Supabase credential in its env) and
has no workflow-level `env:` — secrets go only to the steps that use them.

## 4. Workflow (`.github/workflows/qa.yml`)

- **`production-monitor`** — `--project=readonly` only (its sign-in
  setup runs as a dependency) against the live app. Schedule (8am/8pm
  America/New_York, DST-correct via a runtime clock check) + manual.
  Never on a pull request.
- **`full-suite`** — everything against the app started locally with no
  Supabase credentials. Pull requests to `main` + manual. Never on the
  schedule.

## 5. What the production monitor actually tests (signed in)

Every page in `pages-load.spec.ts` (26 routes) now asserts it did **not**
land on `/login`; `console-errors`, `performance`, `navigation`,
`quickbooks-health` run as the monitor; `authenticated.spec.ts` asserts
the real app shell on 9 business pages, in-app navigation, the 403 write
block, owner-page denial, and no pay-rate figures. Pages the monitor has
no grant for (pricing, company setup, QuickBooks, AI Support, QA) show
the access-denied state — tested as such, not as a pass-through.

**Only with demo data (never against production):** every business
workflow — Quick Job creation, inbox filing, bid filing, bug-report
submission, the two regression tests, payroll math. `permissions.spec.ts`'s
persona-switching tests are demo-only (skipped under real auth; the
monitor's own boundaries are covered by `authenticated.spec.ts`).

## 6. Validation performed locally (no production account, no paid branch)

- **RLS** — the actual migration files 0038/0039/0040 run in PGlite with
  Supabase's `auth.*` helpers, default grants, and per-request role +
  JWT-claims emulation: 15 abuse attempts (forged runs, unauthorized
  updates/deletes, fake and impersonated bug reports, self-assigned
  claim, reading other tables) all refused; the writer's permitted
  operations all succeed. `qa/tests/security/rls-policies.spec.ts`.
- **Real-auth path** — the app run with `NSF_REAL_AUTH_ENABLED=true`
  against `qa/mock/supabase-mock.mts` (a read-only PostgREST/GoTrue
  stand-in over the seed store). Unauthenticated → 307 to `/login`;
  Playwright signs in through the real form; 70/70 readonly tests pass
  signed in; monitor POST → 403, GET → 200; a normal staff session
  POST → 200 (control); wrong password → `/login?mode=error`.
- **Isolation guards** — both negative cases above.
- **Isolated full suite** — 85 passed, 13 skipped (the skips are the
  signed-in checks, which need a login that demo mode doesn't have).

**Not yet validated, by necessity:** the two production accounts don't
exist yet (creating them is a production credential change), so the
first real signed-in run against production is step 6 below — before
the schedule is relied on.

## 7. Activation — exact order

Nothing below has been done. Steps 2–5 are production changes; do them
in this order.

1. **Merge PR #9.** Safe on its own: additive code; `/qa` shows an empty
   state; `production-monitor` will start firing but, with no monitor
   credentials, its sign-in setup fails and the run is simply red in
   Actions — it still never touches data.
2. **Apply migrations** `0039_qa_tracking.sql` then
   `0040_qa_agent_bug_report_policy.sql` (Supabase SQL editor or CLI).
3. **Create the results writer** (Supabase → Authentication → Add user,
   email + strong password, auto-confirm). Then set its claim — either
   in the user's "App metadata" in the dashboard, or in SQL:
   ```sql
   update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"qa_role":"results_writer"}'
   where email = 'qa-results-writer@<your-domain>';
   ```
   Do **not** create an `office_users` row for it.
4. **Create the monitor**: in the app, Company Setup → Staff Access →
   add a staff member (e.g. "QA Monitor", `qa-monitor@<your-domain>`,
   Field/Employee, **not** Owner), grant **View** on: dashboard, job
   requests, projects, schedule, staff, materials, clients, buildings,
   reports — nothing else. Then create its Supabase Auth user with the
   same email (or use the app's "Set up your password" flow with the
   staff setup code) so `office_users.auth_user_id` is linked.
5. **Credentials**: GitHub Actions secrets `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` (public anon key — only used to call the auth
   endpoint), `QA_RESULTS_WRITER_EMAIL`, `QA_RESULTS_WRITER_PASSWORD`,
   `QA_MONITOR_EMAIL`, `QA_MONITOR_PASSWORD`. Vercel env var
   `QA_MONITOR_EMAIL` (same value) + redeploy so the middleware block is
   armed. Optional `QA_GITHUB_DISPATCH_TOKEN` (Vercel) for the "Run QA
   Tests Now" button; optional `QA_PRODUCTION_URL` repo variable.
6. **First real run**: Actions → "Autonomous QA Testing Agent" → Run
   workflow. Confirm in the log that `authenticated.spec.ts` passed
   (real pages, 403 on POST) and that a row appeared on `/qa`. Only then
   treat the schedule as live.

Employee impact of all of the above: none — additive tables, a new
read-only account, a middleware branch that only affects that account.
The monitor's twice-daily load is ~70 page GETs.

## 8. Remaining risks (honest list)

- Step 4 depends on the Owner granting exactly those View permissions;
  a broader grant widens what the monitor can *see* (never what it can
  change). `authenticated.spec.ts` asserts owner pages stay denied.
- If `QA_MONITOR_EMAIL` is not set on Vercel, the edge block is inactive
  and the monitor is "only" a view-only user gated by `canEdit()` — the
  readonly tests still make no writes, but the hard stop is missing.
  The 403 test in `authenticated.spec.ts` fails loudly in that case.
- Performance budgets were calibrated on demo data; expect to loosen
  after the first real runs.
- Dedupe of re-filed findings is time-window based (3 days) because the
  writer deliberately can't read `bug_reports.status`.
- Payroll time-and-a-half behavior is documented in
  `qa/tests/unit/payroll.spec.ts` as current behavior only — untouched,
  per instruction.
