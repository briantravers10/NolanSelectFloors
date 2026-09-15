# Nolan Select Floors — Operations Console

A production-foundation operations platform for a flooring **contractor**
whose main customers are recurring property management companies. It
covers the full chain: management company → property managers/contacts →
buildings → job requests → projects → schedule → staff → labor cost →
materials → completion, plus a lightweight "New Business" leads pipeline,
reporting, and a company-setup discovery questionnaire.

Built with Next.js (App Router) + TypeScript + Tailwind CSS, with a
Supabase/Postgres schema and a data-access layer that runs identically
against a live Supabase project or an in-memory seed dataset.

## Quick start (no setup required)

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to `/dashboard`. No login, no
environment variables, no database required: the app runs entirely on the
realistic seed dataset in `lib/seed-data.ts`, computed fresh each time the
process starts so "today's jobs" and "this week's schedule" are always
current relative to the real date.

```bash
npm run build   # production build — passes with zero configuration
npm run lint    # ESLint
```

## How the data layer works

```
app/**/page.tsx  →  lib/db.ts  →  lib/supabaseClient.ts (configured?)
                                    ├─ yes → real Supabase queries
                                    └─ no  → lib/store.ts (in-memory,
                                             seeded from lib/seed-data.ts)
```

- **`lib/types.ts`** — every table's row shape, mirroring the SQL schema
  column-for-column.
- **`lib/seed-data.ts`** — builds one fully interconnected, realistic
  dataset (5 management companies, 12 contacts, 20 buildings, 12
  employees, 15 projects, job requests, materials, tasks, and a full
  current-week schedule with intentional demo scenarios — see below).
  Dates are computed relative to the real current date every time the
  module runs, so the demo never goes stale.
- **`lib/store.ts`** — a process-wide singleton holding a mutable copy of
  the seed data. This is the "database" whenever Supabase isn't configured
  — every write in `lib/db.ts` (creating a job request, assigning crew,
  moving a project through statuses, etc.) mutates it directly, so the app
  feels real in a demo with zero backend.
- **`lib/supabaseClient.ts`** — returns a configured `SupabaseClient` only
  if `NEXT_PUBLIC_SUPABASE_URL` and a key
  (`SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are
  present in the environment; otherwise returns `null`.
- **`lib/db.ts`** — the only module pages should import from. Every
  function checks `getSupabaseClient()` first and falls back to the
  in-memory store transparently. This is also the single place a future
  auth layer would add row-level scoping.
- **`lib/calculations.ts`** — every derived number in the app (labor cost,
  man count, crew comparisons, driver checks, double-booking, project
  costing) is a pure function over plain arrays, so it behaves identically
  whether the rows came from Supabase or the seed store.

## Connecting a real Supabase project

The app works with zero configuration, but to run it against a live
database:

1. Create a Supabase project.
2. Apply the schema: run the SQL in `supabase/migrations/0001_init.sql`
   against it (via the Supabase SQL editor, or `supabase db push` with the
   Supabase CLI).
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (used server-side for writes)
4. Optionally load the same demo dataset into it:
   ```bash
   npm run seed
   ```
   (`scripts/seed.ts` pushes the exact same `lib/seed-data.ts` dataset via
   the Supabase JS client.)
5. Restart the dev server / redeploy. `lib/db.ts` will detect the env vars
   and start reading/writing the real database automatically — no code
   changes needed anywhere else.

## Schema overview (`supabase/migrations/0001_init.sql`)

Every table carries `company_id` (multi-tenant-ready, even though the app
currently runs as a single company). Highlights:

- **Clients/contacts/buildings**: `client_companies` (management
  companies) → `contacts` → `buildings`, with a `building_contacts` join
  table so a contact's role can differ per building.
- **Job pipeline**: `job_requests` (11-state status enum, from "New
  Request" through "Converted to Project") convert into `projects`
  (13-state status enum from "Approved" through "Paid"), each with
  `project_work_types`.
- **Staff & scheduling**: `employees`, `employee_skills` (18-capability
  enum), `employee_availability` (day-by-day status), and the two tables
  that drive the whole scheduling model:
  - `project_crew_requirements` (project + optional specific date + role +
    quantity — a null date means "every scheduled day")
  - `schedule_assignments` (project + employee + date + role +
    **`base_day_rate`, `rate_multiplier`, `time_and_half`,
    `assignment_cost`** — the cost is snapshotted at assignment time and
    is never recalculated from the employee's current rate, so a later
    raise never rewrites payroll history).
- **Materials**: `materials` (catalog) + `project_materials` (per-project
  line items with a 7-state delivery status enum).
- **Everything else**: `tasks`, `communications`, `project_notes`,
  `documents` / `photos` (metadata only — see Storage note below),
  `new_business_leads`, `activity_log`, `company_setup_answers`.
- Indexes on every `company_id` and on the date columns used for schedule
  queries (`schedule_assignments(company_id, schedule_date)`,
  `employee_availability(employee_id, schedule_date)`, etc.).

## The computed business logic (`lib/calculations.ts`)

This is the actual value of the app, so it's real, server-computed logic —
never a hand-typed display string:

- **Assignment cost** = `base_day_rate × rate_multiplier` (1.0 normal, 1.5
  time-and-half), snapshotted once per assignment.
- **Daily / weekly man count & labor cost** — summed from
  `schedule_assignments`, broken out by day and by normal-vs-time-and-half.
- **Project labor cost** — sum of all of a project's assignments across
  every scheduled date; recomputes automatically as assignments change
  because it's derived, not stored.
- **Crew comparison** — `project_crew_requirements` (by role + quantity,
  optionally date-specific) vs. actual `schedule_assignments` grouped by
  `role_on_job`, per project per date → ✓ complete or ⚠ missing N.
- **Driver check** — if a project needs transportation and no assigned
  employee that day has `is_driver = true`, it's flagged "NO DRIVER
  ASSIGNED".
- **Double-booking check** — any employee assigned to more than one
  project on the same date is flagged, with both project names.
- **Project costing** — labor (from assignments) + materials (sum of
  `project_materials.cost`) + other cost vs. `project_value` → gross
  profit and gross margin %.

All five of these are demonstrated live in the seed data: open the
**Dashboard** or **Schedule** page and you'll see a missing-Sander crew
warning, a "NO DRIVER ASSIGNED" flag, a real double-booking (the same
installer on two jobs the same day), a time-and-half assignment, and a
material-delivery warning on a job starting soon.

## Pages

Dashboard, Clients, Buildings, Job Requests, Projects, Schedule, Staff,
Materials, Tasks, New Business (secondary), Reports, and Company Setup —
all under a responsive shell (`components/Sidebar.tsx` on desktop,
`components/MobileNav.tsx` bottom bar + "More" sheet on mobile/tablet).
Global search (`components/SearchBox.tsx` + `app/api/search/route.ts`)
filters buildings, management companies, contacts, staff, and projects
from the top nav.

**Job Requests** now has two tabs: **Requests** (unchanged) and **Bid
Dashboard** (`/job-requests?view=bids`, `app/job-requests/BidDashboard.tsx`)
— Unclaimed / My Bids / In Progress / Ready-Completed / Awaiting Decision
columns, each card showing management company, PM, building, unit, work
description, date received, a derived priority, bid status, pipeline
stage, estimator, and claimed/updated timestamps.

**Projects** also has two tabs: **List** (unchanged table) and
**Pipeline** (`/projects?view=pipeline`, `app/projects/Pipeline.tsx`) — a
kanban across the 6 primary lifecycle stages with a "Move to stage"
dropdown per card (see "What was deliberately simplified" for why this is
a dropdown rather than drag-and-drop). Moving a card updates the exact
same `projects` row the detail page and Bid Dashboard read.

The **Schedule** week view is the most detail-dense screen in the app —
per-day man count and labor cost, per-project crew cards with required vs.
assigned crew, driver status, and material status, plus a crew-assignment
form with a live cost preview and inline conflict/availability warnings.

## Bid workflow / project pipeline (added on top of the base app)

The base app already modeled one project row moving through a detailed
13-state `status` (Approved → ... → Paid). This layer adds bid ownership
and a primary 6-stage pipeline **on the same `projects` row** — nothing is
duplicated per stage, and both status fields live side by side:

- `status` (existing, 13 states) — fine-grained sub-status, unchanged.
- `pipeline_stage` (new) — the 6 primary stages requested:
  **Project Bid → Bid Accepted → Scheduled → Sent to Crew → Project In
  Process → Project Completed**. This is what the Bid Dashboard and the
  Pipeline kanban view group by, and it's driven from the UI independently
  of the detailed status (both a "Move to Pipeline Stage" control and a
  "Move to Detailed Status" control exist on the project detail page).
- `bid_status` (new) — Unclaimed / Claimed / In Progress / Ready for
  Review / Completed/Sent / Accepted / Rejected — separate from both of
  the above, because a bid can be "In Progress" while the project itself
  is still in the "Project Bid" pipeline stage.

A project's row is created once — either via **"Create Bid"** on an
early-stage job request (starts unclaimed, at pipeline_stage "Project
Bid") or via the existing **"Convert to Project"** on an already-approved
job request (starts at "Bid Accepted", bid_status "Accepted", since the
approval already happened at the job-request stage). Every later change —
claiming, reassigning, sending, accepting, scheduling, completing — is an
`UPDATE` on that same row. See `supabase/migrations/0002_bid_workflow.sql`
for the full column list, including the "set once, never overwritten"
lifecycle timestamps (`bid_claimed_at`, `bid_completed_at`, `bid_sent_at`,
`bid_accepted_at`, `scheduled_at`, `sent_to_crew_at`, `project_started_at`,
`project_completed_at`) that make future turnaround reporting possible.

### Dev "acting as" user selector (placeholder for real auth)

There's still no login. Instead, the top bar has a small **"Acting as"**
dropdown (`components/ActingUserSelector.tsx`) listing the 3 seeded office
estimators (Sarah Bennett, Emma Castillo, David Okoye — `office_users`
table) plus the existing company owner, who stands in for the
Manager/Owner role. Choosing one writes a `nsf_acting_user` cookie
(`app/actions/acting-user.ts`); every claim/reassign/release/bid-status
action reads it via `lib/current-user.ts#getActingUser()`.

**How this maps to future real auth:** once Supabase Auth (or another
provider) is wired up, `getActingUser()` is the only function that needs
to change — swap its body to read the authenticated session's
`office_users` row (or `users` row, for the owner/manager role) instead of
the cookie. No page or server action needs to change, because they all go
through this one function, exactly the same pattern `lib/current-user.ts`
already used for `getCurrentUser()` / `getCurrentCompanyId()`.

The Manager/Owner-only actions (**Reassign Bid** / **Release Bid** on the
project detail page's Bid Ownership card) are gated on
`actingUser.role === "manager"` — a proxy for "logged in as an
owner/manager" until real role-based auth exists. In production this
would be enforced server-side by real auth + RLS, not just hidden in the
UI; the gate here is app-level today for the same reason the rest of the
app's row scoping is app-level (see "How auth will be added later" below).

### Atomic bid claiming

`lib/db.ts#claimBid()` is the one function both UI paths (Bid Dashboard
cards, project detail page) call to claim a bid:

- **Supabase path**: a single
  `UPDATE projects SET assigned_estimator_id = ... WHERE id = ... AND
  assigned_estimator_id IS NULL RETURNING *` — the database resolves the
  race atomically. If no row comes back, the code re-reads the project to
  report who actually holds it.
- **In-memory fallback path**: the "is it still unclaimed" check and the
  "set assigned_estimator_id" write happen in the same synchronous block
  with no `await` between them. Since Node/JS runs application code on a
  single thread, nothing can interleave inside that block — two
  "simultaneous" claim calls can never both observe the bid as unclaimed.
  This is verified directly: two `claimBid()` calls fired via
  `Promise.all` against the same seeded unclaimed bid (`p-9`) resolve to
  exactly one success and one failure that correctly reports the winner's
  name, and a third call against the now-claimed bid also fails cleanly.

Either way, a failed claim never silently succeeds — the caller gets back
`{ ok: false, currentEstimatorId, currentEstimatorName }` and the UI shows
"Claimed by \<name\>" instead of a claim button.

### Duplicate bid detection

`lib/db.ts#findOpenDuplicateBids(buildingId, unitNumber)` queries the
existing `job_requests` and `projects` tables for any still-open record at
the same building + unit — no new table. The New Job Request flow
(`app/job-requests/new/page.tsx` + `app/job-requests/actions.ts`) runs
this check on submit; if matches exist and the form hasn't been
explicitly confirmed, it round-trips back to the same page with a
"Possible duplicate bid" warning listing each match's address/unit,
status, and claimed-by, plus a link to open it. Proceeding requires an
explicit "Create Anyway" click and a non-empty reason, which gets logged
to `activity_log` via `logDuplicateBidOverride()` — that log entry is what
the future "duplicate attempts prevented" report would count.

### Bid workflow reporting (future)

No new reporting UI was built, but every number the requirements listed is
now computable from the columns above without further schema changes:
avg time request→bid (`job_requests.received_at` → `projects.created_at`
for its linked project), avg bid completion time (`bid_claimed_at` →
`bid_completed_at`), bids completed / avg turnaround per estimator (group
by `assigned_estimator_id`), unclaimed/outstanding bid counts
(`bid_status = 'Unclaimed'`), bid acceptance rate (`Accepted` vs.
`Rejected` counts), avg accepted→scheduled time (`bid_accepted_at` →
`scheduled_at`), avg project duration (`project_started_at` →
`project_completed_at`), and duplicate attempts prevented (count of
`activity_log` rows with action `"Duplicate bid override — created
anyway"`).

## Regions, the Buildings Map, and the Haul-Away Run (added on top of the base + bid workflow app)

- **`region`** on `buildings` (5 NYC boroughs + "New Jersey" + "Long
  Island" + "Other") lets the Buildings list group/filter by region
  instead of one flat list. It's an explicit column (not derived at read
  time) for reliability — backfilled in `lib/seed-data.ts` from each
  seeded building's real address, and set from a dropdown on the New
  Building form.
- **`latitude`/`longitude`** on `buildings` (nullable) back the **Map**
  tab on `/buildings`. Seeded buildings carry hand-picked, realistic
  coordinates (see `buildingGeo` in `lib/seed-data.ts`) — there is no live
  geocoding call in this environment, so the New Building form has manual,
  clearly-labeled-optional lat/lng fields instead.
- The map itself (`components/BuildingMap.tsx`, loaded through
  `components/BuildingMapLoader.tsx` via `next/dynamic({ ssr: false })`
  because Leaflet touches `window`) uses **Leaflet + OpenStreetMap tiles**
  — free, no API key, via the `leaflet` + `react-leaflet` npm packages
  (installed cleanly; `react-leaflet@5` was used instead of `@4` since 5.x
  is the first version with React 19 peer support, matching this repo's
  React version). Pins are colored by region and clickable through to the
  building.
- **Haul-Away Run** (`/buildings/haul-away`,
  `components/buildings/HaulAwayPlanner.tsx`) lets you check off active
  job sites needing debris pickup for a day and see them plotted with a
  route line. Two layers:
  1. **Working today, no configuration**: `lib/routing.ts` computes
     straight-line (haversine) distances and a naive nearest-neighbor stop
     order (start at the first selected stop, repeatedly jump to whichever
     remaining stop is closest) — pure math, no external call. The UI
     labels this clearly: **"Estimated (no live routing configured
     yet)"**, with a rough drive-time using an assumed 18 mph average city
     speed (also labeled as rough).
  2. **Real turn-by-turn driving route (bring your own key)**:
     `lib/routing.ts#getDrivingRoute()` is the integration point. Set
     `ROUTING_PROVIDER=google` + `GOOGLE_MAPS_API_KEY`, **or**
     `ROUTING_PROVIDER=mapbox` + `MAPBOX_ACCESS_TOKEN`, and the "Get Live
     Driving Route" button on the Haul-Away Run page will call that
     provider's Directions API instead — zero code changes needed. With
     neither configured (the default), the function returns `null` and
     the page falls back to the estimate; it never throws or crashes.
     - **Google**: create a key at
       [console.cloud.google.com](https://console.cloud.google.com/) →
       APIs & Services → Credentials, after enabling the "Directions API".
     - **Mapbox**: create an access token at
       [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/)
       (the default public token works for the Directions API).

## Photos & Progress (project detail page)

The project detail page's **Photos & Progress** section extends the
existing `photos` table (now with a `category` column — Before / Progress
/ After / Floor Plan / Other — and a `storage_unavailable` flag) rather
than adding a new one. Adding an entry always saves the caption/category/
date; the image upload goes through `lib/storage.ts#uploadProjectPhoto()`,
which attempts a real Supabase Storage upload when a project is
configured and otherwise returns `{ unavailable: true }` — the UI then
shows an inline **"Photo storage isn't configured yet — this entry was
saved without an image"** notice instead of pretending the upload worked.
To enable real uploads later: connect a Supabase project (see below),
create a Storage bucket (defaults to `project-photos`, override with
`SUPABASE_PHOTOS_BUCKET`), and no code changes are needed.

## New create forms (Staff, Clients, Buildings)

`/staff/new`, `/clients/new`, and `/buildings/new` follow the exact
pattern already used by `/job-requests/new`: a server action in that
section's `actions.ts` calling a new `lib/db.ts` create function
(`createEmployee`, `createClientCompanyRecord`, `createBuildingRecord`),
then a redirect to the new record's detail page. Matching "+ New …"
buttons were added to the Staff and Clients list pages (Buildings already
got one alongside "Haul-Away Run"). The New Building form's primary
property manager dropdown narrows to contacts at the selected management
company client-side (`components/buildings/NewBuildingForm.tsx`).

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Public anon key (read fallback) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side writes (preferred key) |
| `SUPABASE_PHOTOS_BUCKET` | No | Storage bucket name for project photos (default `project-photos`) |
| `ROUTING_PROVIDER` | No | `google` or `mapbox` — enables live driving routes on the Haul-Away Run page |
| `GOOGLE_MAPS_API_KEY` | No | Required when `ROUTING_PROVIDER=google` — get one at console.cloud.google.com (enable "Directions API") |
| `MAPBOX_ACCESS_TOKEN` | No | Required when `ROUTING_PROVIDER=mapbox` — get one at account.mapbox.com/access-tokens |

None of these are required to run, build, or deploy the app.

## Deploying to Vercel

1. Push this repo to GitHub (already done if you're reading this in the
   repo).
2. Import it into Vercel as a Next.js project — no build settings need to
   change.
3. (Optional) add the three Supabase env vars in the Vercel project
   settings if you've connected a real database. Skip this to deploy with
   the built-in seed data, which is a perfectly good live demo.
4. Deploy. There's no login step, so the app opens straight to
   `/dashboard`.

## How auth will be added later

There is intentionally no login yet, but the codebase is already shaped
for it:

- `users` table + `user_role` enum (`platform_admin`, `company_owner`,
  `manager`, `office_staff`, `field_worker`) already exist in the schema.
- Every table already carries `company_id`, so row-level security
  policies scoped to `auth.uid()`'s company can be added without
  reshaping any table.
- `lib/current-user.ts` is a single placeholder module
  (`getCurrentCompanyId()` / `getCurrentUser()`) that every page and
  server action already goes through indirectly via `lib/db.ts`. Swapping
  it to read a real Supabase Auth session is the only change needed —
  no page or component needs to be rewritten.
- Once real auth exists, add Supabase RLS policies (`company_id =
  (select company_id from users where id = auth.uid())`) as a defense in
  depth layer on top of the app-level scoping that already exists.

## How SMS (Twilio) will be added later

The **Schedule** page's "Send Schedule (Preview)" button already builds
the exact night-before message text per employee/project/role — it just
shows it in a modal instead of sending it
(`components/schedule/SendScheduleButton.tsx`). Wiring real delivery later
means:

1. Add `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER`
   env vars.
2. Add a `lib/sms.ts` that POSTs to the Twilio Messages API per employee
   phone number.
3. Replace the preview modal's "Close" flow with an actual send action
   that calls it, gated behind a confirmation step.

No schema changes are needed — `employees.phone` already exists.

## Future Automations (architected for, not implemented)

These are the automation hooks the discovery questionnaire and business
context point to. None of them run yet — the schema and data layer are
shaped so each is a self-contained addition:

- **New job request alert** — notify the office the moment a
  `job_requests` row is inserted with status `New Request`.
- **Job approved → create project + checklist** — today this is a manual
  "Convert to Project" button (`app/job-requests/actions.ts`); a trigger
  could also auto-create a standard `tasks` checklist for the new project.
- **Pre-project checks** — a scheduled job that flags any project whose
  `start_date` is within N days but still has undelivered
  `project_materials` or unmet `project_crew_requirements` (the logic
  already exists in `lib/calculations.ts` and powers the Dashboard's
  Attention Required panel; running it as a background check instead of
  on page load is the only change needed).
- **Night-before schedule send** — see the SMS section above; the message
  text is already generated, sending it is the only missing piece.
- **Schedule-changed notify** — diff `schedule_assignments` before/after a
  write and text the affected employees.
- **Material-delayed flag** — already computed
  (`project_materials.status` vs. `expected_delivery`); wiring it to a
  proactive notification instead of a dashboard panel is the remaining
  step.
- **Project completed → billing** — when a project moves to `Completed`,
  auto-draft an invoice line from `computeProjectCosting()`'s numbers.

## What was deliberately simplified for this version

- **File uploads** — `documents` and `photos` tables and their UI exist
  and are wired to real (seed) data, but there is no working upload
  pipeline. A real implementation would add a Supabase Storage bucket per
  table and an upload route; the UI notes this clearly wherever a file
  action would normally live.
- **Schedule Day/Month views** — the Week view (the most important screen
  per the spec) is fully built with live computed data; Day and Month
  views were not built out as separate routes in this pass. The Week view
  already highlights "today" and lets you jump ±1 week.
- **Communications log** — the `communications` table and seed rows exist
  and are used on a couple of detail views, but there's no dedicated
  standalone communications page in this pass.
- **No live Supabase project is connected** in this environment — the app
  ships and builds entirely on the in-memory seed fallback, matching the
  hard requirement that `npm run build` work with zero credentials.
- **No real SMS or Storage integration** — both are previewed/mocked as
  described above, per the spec's explicit instruction not to fabricate a
  working pipeline.
- **Pipeline drag-and-drop** — the Pipeline kanban uses a "Move to stage"
  dropdown + button per card instead of HTML5 drag-and-drop. This was a
  deliberate correctness-over-cosmetics call: the dropdown works with zero
  client JS and no library, and is unambiguous to test, whereas a
  hand-rolled native DnD implementation adds real fragility (drop-target
  detection, touch support, accessibility) for a purely cosmetic gain.
- **Bid "priority"** — there's no dedicated priority column. The Bid
  Dashboard derives a simple High/Normal flag from how long a bid has sat
  unresolved (`app/job-requests/BidDashboard.tsx#derivePriority`) rather
  than adding a schema column for a field nothing else in the spec
  populates.
- **Dev "acting as" user is a cookie, not a session** — intentionally, per
  the spec's "no real auth yet" instruction. See the "Bid workflow /
  project pipeline" section above for exactly how this maps onto real auth
- **Live turn-by-turn routing is stubbed, not faked** — the Haul-Away Run
  page's "Get Live Driving Route" button is fully wired to
  `lib/routing.ts#getDrivingRoute()`, which calls the real Google Maps or
  Mapbox Directions API the moment `ROUTING_PROVIDER` + the matching key
  is set (see "Environment variables" above). With no key configured
  (the case in this environment today), it returns `null` and the page
  shows the haversine/nearest-neighbor estimate, clearly labeled
  "Estimated (no live routing configured yet)" — never a fabricated route.
- **Building geocoding is hand-picked, not live** — seeded buildings carry
  realistic hand-picked lat/lng (see `lib/seed-data.ts`); there is no
  geocoding API call. New buildings created through `/buildings/new` have
  optional, clearly-labeled manual latitude/longitude fields instead.
- **Region is a simple enum, not derived** — `region` is a first-class
  column set at creation time (backfilled correctly for every seeded
  building), not inferred from `city`/`state`/`zip` at read time — more
  reliable, and correct even for edge cases like Stamford, CT (falls back
  to "Other" since it's outside the requested NYC-boroughs/NJ/LI list).
  later.
- **Duplicate-check UX is a full-page round trip, not client-side** — the
  New Job Request form re-checks for duplicates as a server action and
  redirects back with the warning + prefilled fields, instead of a
  client-side fetch/modal. This keeps the whole flow working with zero
  client JS, consistent with how every other form in this app already
  works, at the cost of one extra page load when a duplicate is found.
