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
  Request" through "Converted to Project") convert into `projects`, each
  with `project_work_types`. Projects originally also carried a 13-state
  detailed `status` enum (Approved through Paid) alongside a 6-stage
  `pipeline_stage`; both were collapsed into a single 5-value
  `pipeline_stage` in build 9 — see "Project Pipeline Stage Simplification".
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

> **Build 9 update:** the two overlapping status fields described below
> (`status`, 13 states, and `pipeline_stage`, originally 6 stages) were
> collapsed into one 5-value `pipeline_stage` — see "Project Pipeline Stage
> Simplification" further down for the current model. The rest of this
> section is kept for history/context on how bid ownership and claiming
> work, which is unchanged.

The base app originally modeled one project row moving through a detailed
13-state `status` (Approved → ... → Paid) alongside a separate 6-stage
`pipeline_stage`. This layer added bid ownership **on the same `projects`
row** — nothing is duplicated per stage:

- `pipeline_stage` — now 5 simplified values (see "Project Pipeline Stage
  Simplification"). This is what the Bid Dashboard and the Pipeline kanban
  view group by.
- `bid_status` — Unclaimed / Claimed / In Progress / Ready for
  Review / Completed/Sent / Accepted / Rejected — separate from
  `pipeline_stage`, because a bid can be "In Progress" while the project
  itself is still at pipeline_stage "Bid Sent". **Untouched** by the build
  9 simplification.

A project's row is created once — either via **"Create Bid"** on an
early-stage job request (starts unclaimed, at pipeline_stage "Bid Sent")
or via the existing **"Convert to Project"** on an already-approved job
request (starts at "Bid Accepted", bid_status "Accepted", since the
approval already happened at the job-request stage). Every later change —
claiming, reassigning, sending, accepting, scheduling, completing — is an
`UPDATE` on that same row. See `supabase/migrations/0002_bid_workflow.sql`
for the full original column list, including the "set once, never
overwritten" lifecycle timestamps (`bid_claimed_at`, `bid_completed_at`,
`bid_sent_at`, `bid_accepted_at`, `scheduled_at`, `sent_to_crew_at`,
`project_started_at`, `project_completed_at`) that make future turnaround
reporting possible. `sent_to_crew_at` is no longer written to as of build
9 (see below) but is kept, unused, rather than dropped.

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

## Project Pipeline Stage Simplification (build 9)

The client's own words: "When a project is started, all i need is bid
send, bid accepted, scheduled, in progress and then complete. I dont need
any more info on the status of the job. Use the same colour scheme from
earlier. The status options i have here is way too much info."

### What changed

The project detail page previously showed **two** status controls on the
same `projects` row:

1. A 6-value `pipeline_stage` dropdown (Project Bid, Bid Accepted,
   Scheduled, Sent to Crew, Project In Process, Project Completed).
2. A separate "Move to Detailed Status" control with 13 granular values
   (Approved, Pre-Construction, Materials Required, Materials Ordered,
   Materials Ready, Ready to Schedule, Scheduled, In Progress, Paused,
   Punch List, Completed, Invoiced, Paid).

Both are gone, replaced by **one** 5-value `pipeline_stage`:

**Bid Sent → Bid Accepted → Scheduled → In Progress → Complete**

Old → new mapping (applied to every existing row by
`supabase/migrations/0010_simplify_project_status.sql`):

| Old pipeline_stage   | New pipeline_stage |
|----------------------|---------------------|
| Project Bid          | Bid Sent            |
| Bid Accepted         | Bid Accepted        |
| Scheduled            | Scheduled           |
| Sent to Crew         | In Progress         |
| Project In Process   | In Progress         |
| Project Completed    | Complete            |

The old 13-value detailed `status` column is **not** kept-but-hidden — it
is dropped by the same migration. See "Why the old `status` column was
dropped, not hidden" below for the reasoning and exactly what had to be
re-pointed first.

### Color mapping

Reusing this app's existing badge/color conventions
(`components/ui.tsx#StatusBadge` / `BADGE_COLORS`) rather than inventing a
new palette:

| Stage        | Color                                    |
|--------------|-------------------------------------------|
| Bid Sent     | blue (`bg-sky-100 text-sky-700`)          |
| Bid Accepted | indigo (`bg-indigo-100 text-indigo-700`)  |
| Scheduled    | amber (`bg-amber-100 text-amber-700`)     |
| In Progress  | orange (`bg-orange-100 text-orange-700`)  |
| Complete     | green (`bg-emerald-100 text-emerald-700`) |

`Scheduled` and `In Progress` are shared color keys also used elsewhere in
the app (Task status, COI status, Bid status) — that's intentional, not a
collision: the same word means roughly the same "where things stand" idea
everywhere it appears, so sharing the color keeps the palette consistent
app-wide instead of each feature inventing its own shade of amber/orange.

### Why the old `status` column was dropped, not hidden

The task allowed either dropping the column or keeping it hidden if
something still depended on it. Before deciding, every read of
`project.status` in the app was audited:

- **Buildings, Clients, Materials, Reports, Haul-Away Run** — all five
  used a hardcoded "active statuses" `Set`/array duplicated across each
  file to split "active/upcoming" vs. "past/completed" projects. These
  were all re-pointed to a single new helper,
  `lib/calculations.ts#isActiveProjectStage()`, which is just
  `pipeline_stage !== "Complete"` — simpler than the 10-value set it
  replaced, and it removed five copies of near-identical logic in favor of
  one function.
- **Dashboard "Attention Required" / materials-required flagging** — this
  was already keyed off `project_schedule_days.materials_status` (the
  Schedule's rollup, build 5) and `project_materials.status` (the
  Materials feature) directly, **never** off the project-level detailed
  `status` — no change needed here at all.
- **The Project detail page, Projects list/Pipeline/By-Building views** —
  only ever *rendered* `status` as a badge; no logic depended on it.

With every real dependency re-pointed to `pipeline_stage` and nothing else
reading it, keeping the column around unused (even hidden from the UI)
would just be dead schema for the next person to puzzle over — "is this
safe to ignore, or does something secretly still read it?" Dropping it
removes that question entirely, so the migration drops both the column and
its backing `project_status` enum.

### What was updated

- `lib/types.ts` — `PIPELINE_STAGES`/`PipelineStage` narrowed to the 5
  values; `ProjectStatus`/`PROJECT_STATUSES` and `Project.status` removed
  entirely.
- `app/projects/[id]/page.tsx` — the "Move to Detailed Status" block is
  gone; the 5-stage pipeline dropdown is the only status control left.
- `app/projects/Pipeline.tsx` — kanban now renders exactly 5 columns.
- `app/projects/page.tsx` / `ByBuilding.tsx` — the old detailed-status
  sub-nav/filter is gone; stage badges use `pipeline_stage`.
- `lib/schedule.ts` — `mapJobStatusToPipelineStage`/
  `mapPipelineStageToJobStatus` updated for the 5-stage model (see "Job
  status ↔ pipeline_stage mapping" above).
- `lib/db.ts` — `updateProjectStatus()` removed; `STAGE_TIMESTAMP_FIELD`
  no longer stamps `sent_to_crew_at` (see above); `createBidFromJobRequest`
  starts new bids at "Bid Sent"; `findOpenDuplicateBids` checks
  `pipeline_stage === "Complete"`.
- `lib/seed-data.ts` — every seeded project uses only the 5 new stage
  values; the `status` field is gone from every seed row.
- The Bid Dashboard (`app/job-requests/BidDashboard.tsx`) was checked and
  needed **no changes** — it only ever grouped by `bid_status`, a
  genuinely separate field this simplification doesn't touch.

## New Job — Top-Level Nav Entry Point (build 9)

The client's own words: "The job claimed etc, i need a section where it
will be like new job in the menu bar on the left, this is where he will
add all the info for the new job where the girls will claim the job for
themselves and its assigned to them then."

A new **"New Job"** item was added near the top of the left sidebar
(`components/nav-items.ts`), linking directly to the existing fast-entry
`/job-requests/new` page — the same New Job Request flow that has always
fed the unclaimed-bid queue on the Bid Dashboard for estimators to claim
(build 2). This is **not** a new or duplicate creation flow; it's a second,
more discoverable entry point into the exact same form and the exact same
`createJobRequestAction`, so the owner doesn't have to open "Job Requests"
first to find "+ New Job Request". That original button inside the Job
Requests section (`app/job-requests/page.tsx`) is untouched — both entry
points coexist and land on the same page.

## Photos & Drawings (project detail page, build 9)

The client's own words: "I also need somewhere they can store photos with
titles on them (optional) etc and then drawings also. Take a look at
procore, and mimic what they have and thats what we'll use for how a
project exists." Both live on the project detail page, right after each
other, following the page's existing one-card-per-section convention.

### Photos — Procore-style albums

Extends the existing `photos` table (from an earlier build) rather than
adding a new one — same soft-fail storage pattern, same table, two new
things:

- **`title` (new column, optional)** — a short label shown above the
  (also optional) longer `caption`/note, exactly matching the client's
  "titles on them (optional)" wording. Seed data deliberately includes
  photos with a title, without one, and with only a caption, to
  demonstrate it really is optional in every direction.
- **Albums = the existing `category` column** (Before / Progress / After /
  Floor Plan / Other). A separate `album` column was deliberately **not**
  added — `category` already expresses exactly that grouping, and having
  both would just be two names for the same concept with no way to keep
  them in sync. The gallery now groups photos into these album sections
  (each with a count) instead of one flat chronological list, closer to
  Procore's album-grid presentation.

Adding an entry always saves the title/caption/category/date; the image
upload goes through `lib/storage.ts#uploadProjectPhoto()`, which attempts
a real Supabase Storage upload when a project is configured and otherwise
returns `{ unavailable: true }` — the UI then shows an inline **"Photo
storage isn't configured yet — this entry was saved without an image"**
notice instead of pretending the upload worked. To enable real uploads
later: connect a Supabase project (see below), create a Storage bucket
(defaults to `project-photos`, override with `SUPABASE_PHOTOS_BUCKET`),
and no code changes are needed.

### Drawings — Procore-style version history

A new `project_drawings` table (`supabase/migrations/0010_simplify_project_status.sql`;
see `lib/types.ts#ProjectDrawing`) models Procore's Drawings tool: each
drawing has a `drawing_name` (e.g. "Lobby Floor Plan"), an optional
`drawing_number` (e.g. "A-101"), a `version` starting at 1, and an
`is_current_version` flag. Uploading a **new drawing** creates version 1,
current. Uploading a **new version of an existing drawing** (picked from a
"Upload new version of…" dropdown on the same form, matched by its row id)
does two things in one write (`lib/db.ts#createProjectDrawing()`):

1. Flips the previous current row's `is_current_version` to `false` — it
   is **never deleted or overwritten**, so its file reference, notes, and
   uploader/date stay exactly as they were.
2. Inserts a brand-new row at `version + 1`, `is_current_version: true`,
   inheriting the same `drawing_name`/`drawing_number`.

The project page shows only the **current** version of each drawing
prominently, with a collapsible **"Version History"** link that expands to
show every superseded version (version number, date, uploader, notes) —
seed data includes one drawing (Unit 4B Floor Plan, A-101) at v2 with a
superseded v1 to demonstrate this. File uploads use the identical
soft-fail pattern as Photos, via `lib/storage.ts#uploadProjectDrawing()`
(bucket defaults to `project-drawings`, override with
`SUPABASE_DRAWINGS_BUCKET`) — never a fabricated successful upload.

### What's simplified for this demo

This is a demo app without live file storage configured, so — per the
task's own scope note — the effort went into the **data model and
organization** (albums, titles, versioning, history), not into rendering
real image/PDF thumbnails. A photo or drawing with no configured storage
shows its metadata (title, caption, category/name, number, version,
uploader, date) and an honest "storage not configured yet" notice instead
of a broken image tag or a fabricated preview. Once a real Supabase
Storage bucket is connected, the existing `storage_path`/`file_reference`
values are real object paths ready to resolve to public/signed URLs — no
schema change needed, just swapping the "stored at …" text for an
`<img>`/`<iframe>` once that's wanted.

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

## Pricing & Estimating Formulas

The **Pricing** section (`/pricing`) standardizes how bids/estimates get
priced instead of every estimator eyeballing a number.

- **`material_rate_items`** — reusable priced line items (hardwood, LVP,
  laminate, carpet, tile, underlayment, adhesive/glue, trim, etc.), each
  with a unit, unit cost, supplier, and category. Managed from `/pricing`
  and `/pricing/materials/new`.
- **`pricing_formulas`** — one per work type (Hardwood Installation, LVP
  Installation, Carpet Installation, etc.), carrying an optional
  `labor_rate_per_sqft` and `markup_percent`. Managed from `/pricing` and
  `/pricing/formulas/new`.
- **`pricing_formula_components`** — the line items within a formula, each
  referencing a `material_rate_item` with a `quantity_per_unit_area` (e.g.
  `1.05` sqft of hardwood per sqft of floor for a 5% waste factor, or
  `0.01` gallons of glue per sqft, i.e. 1 gallon per 100 sqft). Edited
  in-place on `/pricing/[id]` — add or remove line items, set the quantity
  per sqft.
- **`lib/pricing.ts#computePricingBreakdown()`** is the single reusable
  calculation function every calculator UI calls: given a formula and a
  square footage, it multiplies each component's `quantity_per_unit_area`
  by the total sqft to get a quantity, prices it against that material
  rate item's unit cost, sums every component into a material cost, adds
  `labor_rate_per_sqft × sqft` for labor, and applies `markup_percent` to
  the material+labor subtotal to get a suggested price — returning a full
  itemized breakdown, not just a total.
- **Estimate Calculator** (`components/EstimateCalculator.tsx`) is a
  reusable client component embedded on both the Job Request detail page
  and the Project detail page's costing section: pick a pricing formula,
  enter square footage, see the live itemized breakdown and suggested
  price, and optionally save it — onto `job_requests.estimated_value` (a
  new column kept deliberately separate from `estimate_amount`, the
  amount actually sent to the client, so a calculator save never
  overwrites a real sent estimate) or onto `projects.project_value`. The
  New Job Request fast-entry form itself was intentionally left untouched
  to preserve its 30-second flow — the calculator lives on the detail
  pages instead.
- Seed data includes 15 material rate items across every category and
  three pricing formulas (Hardwood, LVP, Carpet Installation) each with
  2–3 component line items, a labor rate, and a markup — enough to
  exercise the calculator with realistic numbers out of the box.

## Schedule Redesign (build 5)

The Schedule section was rebuilt on top of the existing data model per a
detailed client spec. `schedule_assignments` (per-employee planned crew,
with `base_day_rate`/`rate_multiplier`/`assignment_cost`/`role_on_job`/
`call_time`) is kept exactly as-is — it's still the single planned-schedule
record. Everything below is additive; see
`supabase/migrations/0005_schedule_redesign.sql` for the SQL and
`lib/schedule.ts` for the calculation/sorting/summary logic.

### Key data-model decision: "one row per job per day"

The Daily view renders **one row per job per day**, not one row per crew
assignment. A job can have several `schedule_assignments` rows (one per
employee) sharing the same `project_id` + `schedule_date`, and they all
need to share *one* schedule color, *one* COI status, *one* materials
status and *one* job status. Putting those fields directly on
`schedule_assignments` would mean reconciling them across every crew row
for the same job/day, and would leave a job with **zero** crew assigned
nowhere to hold a color/status at all — a real case (the PINK "waiting on
scheduling" priority explicitly described in the spec). So a new
lightweight join table, **`project_schedule_days`** (unique on
`project_id` + `schedule_date`), *is* the "job/day entry" the Daily list
renders: `schedule_color`, `coi_status`, `materials_status`, `job_status`,
`work_type_id`, `notes`. `schedule_assignments` continues to hold the
per-employee crew rows underneath it, untouched. `getOrCreateProjectScheduleDay()`
in `lib/db.ts` lazily creates one (defaulting to Pink) the first time a
job/day's color or any status is touched, so a job with no explicit entry
yet still renders sensibly.

### Job status ↔ pipeline_stage mapping

`job_status` (`Scheduled` / `In Progress` / `Complete`) is a separate field
from `schedule_color` and from `pipeline_stage` — never conflated. Setting
it from the Schedule always writes through to the real
`projects.pipeline_stage` (via the existing `updateProjectPipelineStage()`,
so the set-once lifecycle timestamps still stamp correctly) — never an
isolated duplicate. The mapping (`lib/schedule.ts`
`mapJobStatusToPipelineStage` / `mapPipelineStageToJobStatus`):

| job_status    | pipeline_stage                            |
|---------------|--------------------------------------------|
| Scheduled     | Bid Sent, Bid Accepted, **Scheduled**       |
| In Progress   | **In Progress**                             |
| Complete      | **Complete**                                |

(Bold = the stage `job_status` writes when set from the Schedule; the
others are simply the stages that read back as that same `job_status`
before the schedule ever touches it.)

> **Build 9 update:** since `pipeline_stage` was simplified to 5 values
> (see "Project Pipeline Stage Simplification" below) that are now nearly
> 1:1 with `job_status`'s 3 states, this mapping got simpler too — "Bid
> Sent"/"Bid Accepted" are just earlier pre-schedule states that still read
> back as `job_status` "Scheduled", exactly as before; "Sent to Crew" no
> longer exists as a separate row since it was merged into "In Progress".

### Work types: a new table, scoped to the Schedule

The existing `work_type` Postgres enum (used by `project_work_types` and
`pricing_formulas`) is left untouched — turning an enum used by two live,
unrelated features into a table is a much bigger and riskier migration
than this phase's scope. Instead, the Schedule's own per-job-per-day work
type field gets its own small, editable **`work_types`** table (id,
company_id, name, active), seeded from the same value set as the existing
enum plus the two minimum values the spec calls for (Repair, Installation).
It's managed from **Company Setup** (add/rename/deactivate, no code
changes) via `app/schedule/actions.ts`'s `addWorkTypeAction` /
`renameWorkTypeAction` / `toggleWorkTypeActiveAction`.

### Materials status: a schedule-facing rollup, not the detailed enum

The existing `project_materials.status` enum (7 values: Needed, Quote
Requested, Ordered, Partially Delivered, Delivered, Problem, Returned)
stays exactly as-is for the Materials feature. The schedule's quick-glance
control needs to be "dead simple" per the spec, so `project_schedule_days`
gets its own 3-value `schedule_materials_status` rollup instead (Not
Ordered / Ordered / Sent-Delivered) — a deliberate simplification, not a
replacement.

### Actual hours vs. planned crew

`schedule_assignments` = planned. A new **`actual_labor_entries`** table
(employee_id, project_id, work_date, hours, start_time, end_time, notes)
holds what actually happened — an employee can have multiple entries on
the same day across different jobs, and logging actual hours never
overwrites the plan. `lib/schedule.ts#actualHoursWarnings()` produces
**soft, non-blocking** warnings (never a hard validation error) for a
day's total hours over 16, or two same-employee/same-job/same-hours
entries logged within 15 minutes of each other (likely an accidental
duplicate) — both shown as inline banners on the End of Day Review.

### End-of-Day Review & "Confirm Day"

`/schedule/review` walks through the day's jobs (crew, statuses) plus an
actual-hours log, ending in a "Confirm Day" action. A new
**`daily_schedule_confirmations`** table (one row per company+date,
upsert-style) records who confirmed and when. Confirming does **not**
lock the day — later edits stay possible and are audit-logged like any
other change, and re-confirming just updates the same row.

### Change History / Activity

Reuses the existing `activity_log` table and pattern exactly — no schema
change (it already has free-text `action`/`detail` and a nullable
`related_type`/`related_id`, which already covers everything this phase
logs). `lib/schedule.ts#isScheduleActivity()` recognizes the new schedule
action strings (crew assignment changes, schedule color/COI/materials/job
status changes, actual-hours entries/edits, day confirmations, work-type
admin changes) so `/schedule/history` shows only schedule activity, not
the whole app's log. Filterable by date, user, job/project, and employee.

### Completed Job Summary

`/schedule/completed` lists every project at `pipeline_stage: "Project
Completed"`. `lib/schedule.ts#compileCompletedJobSummary()` compiles
everything — job info, timeline (derived from the earliest/latest
`schedule_assignments` + `actual_labor_entries` + `project_schedule_days`
dates), per-employee labor, COI/materials snapshot, accumulated project
notes — from existing data. **Per-employee hours use `actual_labor_entries`
when present, falling back to a planned-schedule hours-equivalent (one
`schedule_assignments` day = 8 hours) when an employee has no actual-hours
logged for that job** — a deliberate choice so the summary isn't empty for
older/lightly-tracked jobs (seed data's actual-hours logging is
intentionally sparse, matching a real office's habits). The **only**
manually-entered field is "Completion Notes" — reuses the existing
`project_notes` table with a marker `author_name` of `"Completion Notes"`
rather than a new column, so no schema change was needed for it.
Searchable/filterable by address/unit/management company, employee, work
type, and date (within the job's date range).

### Schedule UI: a hard split between View Schedule and Create/Edit Schedule (build 5.1)

A follow-up client pass corrected the first cut of the Schedule UI, which
mixed viewing and editing (inline color/COI/materials/work-type dropdowns
directly on each Daily row). The data model, audit logging, actual hours,
End-of-Day Review and Completed Job Summary logic are all **unchanged** —
this was an interface-only correction.

- **View Schedule** (`/schedule`) is now strictly **read-only**. Daily is
  a single full-width vertical list of large, spacious job blocks — one
  per row, not a grid, not side-by-side cards — sorted by schedule color
  priority (Yellow → Blue → Gray → Pink) then by earliest crew call time
  (`lib/schedule.ts#sortScheduleDayRows`, unchanged). Every field from the
  spec is plain labeled text/badges and **always visible**, no
  expand/collapse: building/unit/address, management company, point of
  contact with clickable `tel:`/`mailto:` links, crew (count + full names
  only, no skills), "Certificate of Insurance" spelled out in full with
  status text (Approved gets a clear green treatment), "Materials" status,
  "Work Type", and the job notes/work description. **The schedule color
  now tints the entire job block's background** (`components/schedule/
  badges.ts#SCHEDULE_COLOR_BLOCK_CLASSES`) instead of appearing as a
  dropdown or a small dot — this was the client's single most important
  correction. The only interactive elements left on a block are
  navigation links ("View Project" and "Edit This Entry" — the latter
  jumps to Create/Edit Schedule for that exact job/date), which aren't
  editing controls. Weekly stays a compact color-dot-per-day view and
  Monthly stays the calendar grid with color-dot indicators — both were
  already read-only and needed no changes; clicking a day/date still opens
  that date's Daily view.
- **Create / Edit Schedule** (`/schedule/edit`, new) is where every
  control now lives: a large single-column form (Date, Job, Schedule Type,
  Crew as a checkbox list of employee names, Certificate of Insurance,
  Materials, Work Type, Job Status, Job Notes, one "Save to Schedule"
  button), plus a "load an existing entry" picker filterable by date. Its
  `saveScheduleEntryAction` (`app/schedule/actions.ts`) reuses the exact
  same per-field actions the old inline dropdowns called
  (`setScheduleColorAction`/`setCoiStatusAction`/`setMaterialsStatusAction`/
  `setJobStatusAction`/`setWorkTypeAction`/`setScheduleNotesAction`,
  and `addAssignmentAction`/`removeAssignmentAction` for crew) — and so the
  same `getOrCreateProjectScheduleDay`/`updateProjectScheduleDay`/
  `createScheduleAssignment`/`deleteScheduleAssignment` calls and the same
  `activity_log` audit trail — only calling each one when that field
  actually changed, so re-saving an untouched value never creates a
  spurious Change History entry, and editing never creates a duplicate
  schedule record. Saving redirects back to View Schedule for that date.
  `components/schedule/InlineSelect.tsx` and `AddCrewInline.tsx` (the old
  inline-editing controls) were removed since nothing renders them anymore.
- End of Day Review, Change History and Completed Job Summary are
  unchanged functionally; Review's job list now uses the same read-only
  blocks (with an "Edit This Entry" link) instead of the old inline
  dropdowns, consistent with the hard split.
- `components/schedule/ScheduleSubNav.tsx` now lists all five screens:
  View Schedule, Create / Edit Schedule, End of Day Review, Change
  History, Completed Jobs.

### Items to Order / Collect (build 8)

A lightweight, per-schedule-entry checklist for quick pickups a crew needs
for one specific day's job — the client's own example: "collect 3 buckets
of glue." This is **not** the existing, heavier Materials system
(`materials`/`project_materials`, supplier/cost/delivery-date tracking for
real material orders at the project level) — it's a fast "grab this"
list, kept deliberately simple:

- **Data model** (`supabase/migrations/0009_schedule_pickup_items.sql`):
  one new table, `schedule_pickup_items` — `project_schedule_day_id` (FK
  to `project_schedule_days`), a single free-text `description` (e.g. "3
  buckets of glue" — the quantity, if any, is just typed into the text
  rather than split into its own column), and a two-value `status` enum
  (`Needed` / `Collected`, a checkbox-equivalent). No supplier/cost/date
  fields — that's what the Materials system is for.
- **Data layer** (`lib/db.ts`): `listSchedulePickupItems` /
  `listSchedulePickupItemsForDay` / `createSchedulePickupItem` /
  `toggleSchedulePickupItemStatus` / `deleteSchedulePickupItem`, each
  audit-logged to `activity_log` (`related_type: "project"`) the same way
  every other schedule field is. `lib/schedule.ts#buildScheduleJobRows`
  attaches each row's items (`ScheduleJobRow.pickupItems`) so both
  View Schedule and Create/Edit Schedule read from the same view model.
- **Create/Edit Schedule** (`components/schedule/ScheduleEditForm.tsx`):
  an "Items to Order / Collect" section — a text input + Add button, plus
  the existing items with a "Mark Collected"/"Remove" action next to each.
  Unlike the rest of the form, these save immediately (via
  `addPickupItemAction`/`togglePickupItemStatusAction`/
  `deletePickupItemAction` in `app/schedule/actions.ts`), not deferred to
  "Save to Schedule" — the same "quick inline add" convention as
  `AddTimeOffForm`. Adding the first item on a job/date that isn't on the
  schedule yet reuses `getOrCreateProjectScheduleDay`, same as every other
  per-field schedule action. A brand-new, not-yet-saved entry shows the
  input disabled with a note to save the entry first, since there's no
  `project_schedule_days` row to attach items to until then.
- **View Schedule** (`components/schedule/ScheduleDayRowCard.tsx`): a
  small, read-only "Items to Collect" list — only rendered when at least
  one item exists — showing each description with a plain "✓ Collected" /
  "— Needed" label, no checkboxes, consistent with the View/Edit
  read-only split above.

## Labor Cost Tracking (build 6)

Adds ACTUAL-hours labor cost tracking as an addition to the existing
employee/actual-hours/Completed Job systems. Nothing about the just-built
Schedule redesign (View/Create-Edit split, `schedule_assignments`) changed —
see `supabase/migrations/0006_labor_cost_tracking.sql`, `lib/labor-cost.ts`
and `lib/current-user.ts`.

### Reconciling planned vs. actual labor cost

There are now, deliberately, **two separate labor-cost systems**:

| | PLANNED cost (builds 1-2) | ACTUAL cost (build 6) |
|---|---|---|
| Source table | `schedule_assignments` | `actual_labor_entries` |
| Driven by | the crew that was **scheduled** | the hours someone **actually worked** |
| Rate fields | `base_day_rate` / `rate_multiplier` / `time_and_half` / `assignment_cost` (snapshotted at assignment time) | `rate_type` / `rate_amount` (snapshotted at entry-creation time, see below) |
| Computed by | `lib/calculations.ts` (`projectLaborCost`, `summarizeDay`, `computeProjectCosting`) | `lib/labor-cost.ts` |
| Still used by | Project Costing box, Dashboard, Reports — **unchanged, untouched** | Job Labor Summary, Completed Job Summary's "Labor Cost by Employee", End-of-Day Review's per-day total, per-employee Labor History |

Both stay on the project detail page: the existing "Costing" card still
shows the planned `laborCost`, and the new "Job Labor Summary — Actual Cost"
card shows the actual figure right below it, clearly labeled, so nobody
confuses the two. The spec calls for actual cost to be the headline number
wherever "how much did we actually spend" is being asked (Completed Job
Summary, Job Labor Summary, End-of-Day Review) — the planned system keeps
its existing job (estimating/budgeting before the fact) everywhere else.

### Employee pay rate

`employees` gained `pay_type` (`'daily' | 'hourly'`), `daily_rate` and
`hourly_rate` (nullable — only the one matching `pay_type` is meaningful).
The pre-existing `day_rate` column is untouched and keeps backing the
planned-cost system above; a migration backfill seeds `daily_rate`/`pay_type`
from it so nothing shows $0 the moment the migration runs, but the two are
independent from that point on — editing one never touches the other.

### The allocation formula

All of it lives in `lib/labor-cost.ts#computeActualLaborCosts`, which is the
single function every other calculation (`jobLaborSummary`,
`dayLaborCostTotal`, `employeeLaborHistory`, the Completed Job Summary's
labor section) is built on top of.

- **Hourly employees**: `cost = hours × rate_amount`, independently per
  job/entry — no allocation needed. *Example: John, hourly $30 — Job A 5h =
  $150, Job B 3h = $90.*
- **Daily-rate employees**: the day's entries for that employee are grouped
  by `work_date`, and the daily rate is allocated **proportionally by
  hours worked** across them. *Example: Paul, daily $300 — Tuesday: Job A
  6h + Job B 2h (8h total) → Job A gets 6/8×$300=$225, Job B gets
  2/8×$300=$75.* If Paul only worked one job that day, that job's hours ARE
  the day's total hours, so the proportion is 100% and it gets the full
  $300 — never a partial "assumed 8-hour day" rate, and never more than one
  job billed the full daily rate on the same day (amounts are adjusted with
  a rounding-remainder rule so they always sum to *exactly* the daily rate,
  never overcharging).

### Historical Pay Rate Accuracy — the rate snapshot

The spec's key tension: labor cost must be a **live, derived** calculation
(never something the office employee types in or that could drift out of
sync) — but a later raise must **never** retroactively change an
already-logged job's cost. Both are satisfied by snapshotting the
*applicable* rate onto each entry, not by storing a dollar total:

- `actual_labor_entries` gained `rate_type` and `rate_amount`.
- `lib/db.ts#createActualLaborEntry` copies the employee's **current**
  `pay_type`/rate onto the new row at the moment it's saved (mirroring
  exactly what `createScheduleAssignment` already does for
  `schedule_assignments.base_day_rate` in the planned system).
- Editing an entry's hours (`updateActualLaborEntry`) never touches the
  rate snapshot — only hours/times/notes can change.
- Editing an employee's rate (`lib/db.ts#updateEmployee`) never touches any
  existing `actual_labor_entries` row.
- Every cost calculation reads `entry.rate_type`/`entry.rate_amount` —
  **never** the employee's live current rate — so the math is always
  correct for the day it happened, no matter how many raises follow.

Verified in the seed data: Sal Marchetti (`e-8`)'s current `daily_rate` is
$330, but his three old `actual_labor_entries` rows for the completed job
`p-7` (~12 days ago) are snapshotted at $300 (his rate before a raise).
`jobLaborSummary('p-7', ...)` correctly totals his cost at $900 (3 × $300),
not $990 — changing his profile rate today does not change that number.

### Access Control — role mapping

There's still no real login (per every prior phase's "no real auth yet"
constraint) — pay rates and labor-cost dollar figures are gated the same
way bid-claiming already is: via the existing `office_users` "acting as"
dev-user concept (`lib/current-user.ts`). A new field, **`access_role`**
(separate from the pre-existing `role` field, which only governs
bid-claim/estimator-vs-manager permissions), was added to `office_users`:

| `access_role` | Maps to spec's | Can view pay rates / labor $ | Can edit pay rates |
|---|---|---|---|
| `owner_admin` | Owner/Admin | Yes | Yes |
| `office_staff` | Authorized Office Staff | Yes (view only) | No |
| `field_employee` | (lower tier, hidden by default) | **No — hidden entirely** | No |

The dev "acting as" sentinel Owner persona (`OWNER_ACTING_ID`, standing in
for the real company owner) is hardcoded to `owner_admin`. Seed data maps
the three office users: Sarah Bennett → `owner_admin`, Emma Castillo →
`office_staff`, David Okoye → `field_employee` — switch between them with
the TopBar's "Acting as" selector to see the gating live.

`lib/current-user.ts` exports the two checks every page/component uses:
`canViewLaborCost(actingUser)` (owner_admin OR office_staff) and
`canEditPayRates(actingUser)` (owner_admin only). This is enforced by
**not rendering** the field/section at all for a disqualified user — e.g.
a `field_employee`-role acting user sees no Pay Rate stat, no rate column
on the Staff list, no Job Labor Summary card, no per-day labor cost figure
on End-of-Day Review, and no Labor Cost section on the Completed Job
Summary. **This is a UI-level gate only** — exactly like the rest of this
app's permission model, there is no session/auth layer preventing a
determined user from hitting an API route directly; that's out of scope
until real auth ships (see "How auth will be added later" below, which
this access_role tier is designed to map onto directly — a real login
would resolve to one of these three tiers instead of a cookie).

Gated surfaces: Staff list (`app/staff/page.tsx`) and profile
(`app/staff/[id]/page.tsx`) pay-rate fields + edit form + Labor History;
New Staff form's pay-rate section; project detail page's "Job Labor
Summary — Actual Cost" card; Completed Job Summary's "Labor Cost by
Employee" / "Total Labor Cost"; End-of-Day Review's "Total Labor Cost —
This Day" figure. **View Schedule itself shows no dollar figures at all**,
per the spec's explicit instruction not to clutter the just-redesigned
read-only schedule view with financial data.

### Audit logging

`lib/db.ts#updateEmployee` logs any change to `pay_type`/`daily_rate`/
`hourly_rate` to the existing `activity_log` table — employee name, old
pay type + rate, new pay type + rate, effective date (today's date, since
rates apply going forward — the entry-level snapshot above is what makes
old jobs immune, so a separate rate-history table isn't needed), and the
acting user. This reuses the same `logActivity()` helper as every other
audited change in the app (crew assignments, status changes, etc.).

### Where each spec requirement lives

- **Job Labor Summary** (employees, days worked, hours, cost per employee,
  totals) — `lib/labor-cost.ts#jobLaborSummary`, surfaced on the project
  detail page.
- **Completed Job Summary update** — `lib/schedule.ts#compileCompletedJobSummary`
  now calls `jobLaborSummary` internally and adds `laborCost` per employee
  row + `totalLaborCost`; rendered in `CompletedJobCard.tsx`.
- **Per-day labor cost** — `lib/labor-cost.ts#dayLaborCostTotal`, shown on
  End-of-Day Review (`app/schedule/review/page.tsx`), never on View
  Schedule.
- **Per-employee history** — `lib/labor-cost.ts#employeeLaborHistory`, shown
  on the staff profile page.

## Vacation & Sick Day Tracker (build 7)

A simple, auditable day-off LOG for employees — see
`supabase/migrations/0007_time_off.sql`, `lib/time-off.ts`, and
`lib/db.ts`'s time-off CRUD functions.

### Data model decision — new table, not an extension of `employee_availability`

The original spec (build 1) called for an `employee_availability` table
with statuses (`working`/`available`/`day_off`/`vacation`/`unavailable`),
and that table does exist (`supabase/migrations/0001_init.sql`) — it's
seeded and it already powers the Dashboard's "Staff Off" stat
(`lib/dashboard.ts`). But it was never built out any further: no
create/edit UI, no audit trail, and — critically — no date RANGE concept,
since it's one row per employee per single calendar day.

Rather than overload that table for this phase, a new **`time_off_entries`**
table was added instead:

- a multi-day vacation is ONE row (`start_date`/`end_date`), not N single-day
  rows to create/edit/delete in lockstep
- `type` (`Vacation` / `Sick` / `Personal` / `Unpaid`) matches what an owner
  actually wants to log, closer to the client's ask than a generic
  5-value availability status
- `created_by`/`updated_by` + `activity_log` audit entries (who logged
  whose time off, and when) follow this app's existing audit pattern —
  `employee_availability` has none of that

`employee_availability` is left completely untouched — still seeded, still
read by the Dashboard. The two sources are **additive, not conflicting**:
the Dashboard's "Staff Off" stat now counts someone as off if EITHER
source says so (`lib/dashboard.ts`), so nothing that worked before regressed.

**Deliberately simple**: this is a day-off LOG, not an accrual/balance
system. There's no "vacation days remaining" running balance, no monthly
accrual, and no pro-rating by hire date — only a flat "N days allowed per
calendar year" compared against a year-to-date sum (see below). A real
accrual/balance system (monthly accrual, rollover rules, pro-rating new
hires) could be layered on top of this same `time_off_entries` table later
without changing anything built here.

### Annual Allowance (vacation / sick days awarded)

Each employee has their own `vacation_days_allowed` / `sick_days_allowed`
(nullable integers, added to `employees` in the same migration) — **not** a
flat company-wide number, since different hires get different allowances.
Unset (`null`) means "not tracked yet" for that employee, not "zero days
allowed", so a brand-new hire never shows as instantly over-allowance.

Usage is a **pure computed rollup**, not a stored balance:
`lib/time-off.ts#computeTimeOffUsage` sums an employee's `time_off_entries`
days (clipped to the current calendar year) separately for `Vacation` and
`Sick` entries, and compares each sum to the employee's allowance.
`Personal`/`Unpaid` entries never count against either allowance.

This is surfaced in three places:
- **Staff profile** (`/staff/[id]`) — "Vacation Used" / "Sick Used" stat
  tiles showing `X of Y days` for the current year, plus a rose "Over
  Allowance" banner when either is exceeded.
- **"+ Add Time Off" form** (`components/staff/AddTimeOffForm.tsx`) — a
  live, non-blocking inline warning as the office employee picks
  dates/type: *"⚠ This would put Tommy over his allowed vacation days
  (already used 3 of 3)"*. Saving is never blocked — same "warn, don't
  block" philosophy as everywhere else in this app.
- **Staff list** (`/staff`) — a small rose "⚠ Over Allowance" badge next to
  anyone currently over, so the owner notices without opening every
  profile.

**No real notification system exists yet** (same as the Email Assistant /
Invoice Routing rules further down this README — architected for, not
wired to a live pipeline). These in-app banners/badges/inline warnings
**are** the notification for now; there is no email or push alert sent
when someone goes over their allowance.

### Access control

Reuses the exact same access-role gate as pay rates from the Labor Cost
Tracking phase (`lib/current-user.ts` `canViewLaborCost`/`canEditPayRates`),
via two thin wrappers — `canViewTimeOffAllowance`/`canEditTimeOffAllowance`
— kept as separate named functions so the two concerns (pay vs. time-off
allowance) can diverge later even though they're identical today:
Owner/Admin can view AND edit the allowance numbers, Office Staff can view
only, Field/Employee can't see them at all.

This gate applies ONLY to the allowance numbers and the "Over Allowance"
badge/banner — **whether someone is currently on vacation/sick/etc. is
visible to everyone** (the "X today" badge on the Staff list, the Crew
picker warning below), consistent with the rest of this app's philosophy
that day-off status itself isn't sensitive, only pay-adjacent dollar/HR
figures are.

### Scheduling-conflict warning

`lib/time-off.ts#isEmployeeOffOn` / `getTimeOffForDate` are pure functions
over a `time_off_entries` array (same convention as
`lib/calculations.ts#findDoubleBookings`), so callers fetch the data once
and pass it in — no data fetching inside the helpers themselves.

- **Crew picker** (`components/schedule/CrewPicker.tsx`) — when the
  selected schedule date falls within a checked/selected employee's logged
  time off, their name gets a clear "⚠ On Vacation" / "⚠ Out Sick" / "⚠
  Personal Day" / "⚠ Unpaid Leave" label, both in the checklist and on
  their removable chip. The warning re-computes live as the Date field
  changes (`ScheduleEditForm.tsx` lifts that one field's state into a
  `useState`, everything else in the form stays an uncontrolled
  `defaultValue` input submitted natively, same "use client" scope as
  before).
- **Dashboard** (`lib/dashboard.ts`) — every `schedule_assignments` row
  that falls inside a logged time-off range becomes an Attention Required
  item ("Tommy Nguyen is scheduled on 4 day(s) … while marked Vacation
  …"), grouped by (employee, time-off entry) rather than one item per
  conflicting day so a multi-day vacation doesn't flood the list.

Exactly like the existing double-booking warning, **this never blocks the
assignment** — the office employee can still keep them on the crew if
there's a legitimate reason (someone came back early, an emergency
call-in, etc.).

## Client Navigation, "Last Worked With" reminder, and Jobs by Building (build 8)

### Management Company → Buildings → Point of Contact

The Client → Building → Point of Contact hierarchy (management companies,
buildings, contacts, `building_contacts`) already existed from build 1 —
this pass only closed a small gap: the Client detail page's Buildings list
now shows each building's primary point of contact (name + title) inline,
so it's visible without an extra click into the building's own page. See
`app/clients/[id]/page.tsx`.

### "Last Worked With" reminder

`lib/last-worked.ts#getLastWorkedWithClient(clientCompanyId, excludeProjectId?)`
is a **pure derived calculation** over the existing `projects` +
`buildings` tables — no new table. It finds the most recent PREVIOUS
project tied to a management company (excluding the job currently being
created, if it already has a project id) and returns a human-readable
sentence like *"Last worked with Vanguard Property Group: 3 months, 2
weeks ago"*, or *"No prior jobs on record for ABC Property Management."*
when there's no history.

**Date choice**: uses a project's `actual_end_date` when set (the most
meaningful "we were last on site" date), falling back to `start_date`,
then `created_at` — favoring "when work actually wrapped" over "when it
was booked". **Format**: breaks the day gap into years/months/weeks/days
and renders only the two largest non-zero units (e.g. "3 months, 2 weeks"
rather than "3 months, 2 weeks, 0 days"), so it never shows all four units
cluttered together.

Shown in two places:
- **New Job Request form** (`/job-requests/new`) — once a building (and so
  its management company) is selected, a small inline reminder appears
  under the picker. Implemented as a tiny client component
  (`BuildingSelectWithReminder.tsx`) that calls a server action on change,
  so the rest of the form's typed fields are never lost to a page reload.
- **Job Request detail page** (`/job-requests/[id]`) — a banner at the top
  of every job request shows the same reminder for its management company.

### Jobs by Building (new Projects tab)

`/projects?view=by-building` — a third tab alongside the existing List and
Pipeline views (same `?view=` convention as Pipeline), reusing the exact
same `projects` data, **not** a new "Jobs" concept or table. Groups every
project by building, and within each building sorts by unit number:
numeric prefix first (so "3B" sorts before "12A"), then any letter suffix,
then chronologically by start date as a final tiebreak. See
`app/projects/ByBuilding.tsx`.

## Owner's Agenda & Future Google Calendar Sync (build 8)

A lightweight **"My Agenda"** section (`/agenda`) for the owner's own
meetings, site visits and personal reminders — **separate from the
operational job Schedule** (`/schedule`, crew/job dispatch). Nothing in
this feature reads from or writes to `schedule_assignments`; the two are
independent calendars that happen to share an owner.

### What's built now

- **`agenda_events` table** (`supabase/migrations/0008_owner_agenda.sql`):
  `title`, `event_date`, nullable `start_time`/`end_time`, nullable
  `location`/`notes`, an optional `related_type`/`related_id` link (same
  shape as `RelatedRecordType` used by tasks/communications/documents
  elsewhere — e.g. a check-in tied to a management company), `source`
  (`'Manual'` | `'Google Calendar'`), and a nullable `external_event_id`
  placeholder for a future Google event id.
- **`owner_user_id`** is a plain text column, not a foreign key — there is
  no per-user `users` table beyond `office_users` yet (see
  `lib/current-user.ts`'s dev "acting as" persona and the `OWNER_ACTING_ID`
  sentinel `"owner"`). This mirrors the same identifier the rest of the app
  already uses to stand in for the Owner/Admin role.
- **`/agenda` UI**: a simple day list across the current week (today
  highlighted), a "+ Add Event" form (title, date, start/end time,
  location, notes, and an optional link to a management company), and a
  "Connect Google Calendar" section.
- **Seed data**: five realistic events across the current week — two site
  visits, a management-company quarterly check-in, a vendor-portal renewal
  call, and one clearly personal (non-job) reminder — so the page has
  something real to show out of the box.

### "Connect Google Calendar" — explains, never fakes

Clicking "Connect Google Calendar" calls `lib/google-calendar.ts#syncAgendaWithGoogleCalendar()`,
which **never attempts a real OAuth redirect and never fakes success**. It
checks for `GOOGLE_CALENDAR_CLIENT_ID` / `GOOGLE_CALENDAR_CLIENT_SECRET` /
`GOOGLE_CALENDAR_REFRESH_TOKEN` (none of which are set in this
environment) and returns an honest "not configured" result with an
explanation of what's needed — the exact same "architected but not live"
pattern as `lib/routing.ts` (real driving directions behind an env-var
check, `null`/soft-fail otherwise) and the Email Assistant rules below.
**No live Google Calendar API call is made anywhere in this codebase.**

### What a future Google Calendar sync would need

1. A **Google Cloud OAuth app** with the **Google Calendar API** enabled,
   consented to by the owner's account (read/write scope, so both
   directions of sync are possible).
2. A stored **refresh token** per owner (`GOOGLE_CALENDAR_REFRESH_TOKEN`,
   or a per-user column once real auth exists) so the sync can silently
   get new access tokens without the owner re-authenticating each time.
3. `syncAgendaWithGoogleCalendar(ownerUserId)` would exchange that refresh
   token for an access token, call `events.list` on the owner's calendar,
   and **upsert** each result into `agenda_events` keyed on
   `external_event_id` (`lib/db.ts#upsertGoogleAgendaEvent` already exists
   for this — unused today, ready once a real sync calls it) — so re-runs
   never create duplicates (`agenda_events` also has a unique index on
   `(owner_user_id, external_event_id)` enforcing this at the DB level).
4. Manually-entered events could optionally push out to Google too
   (`events.insert`/`events.update`), but that's a one-way (Google → app)
   sync at minimum to start.
5. A scheduled job or on-demand button (the existing "Connect Google
   Calendar" button, once real) would trigger the sync — no push
   webhook is required for a first pass.

**Manual entry stays fully functional regardless** — the "+ Add Event"
form is a permanent part of the workflow, not a placeholder until sync
ships.

## Email Assistant & Invoice Routing (Architecture, Not Yet Live)

The long-term goal is an AI assistant watching the owner's Gmail that
detects supplier invoices and calendar-worthy requests (like a property
manager asking for a site visit), then routes invoices into an organized
structure by supplier and by job/address — with a manual override for
one-off/case-by-case handling. **No live Gmail or Calendar API call is
made anywhere in this codebase** — Google OAuth isn't available in this
environment, and the spec was explicit that this pass builds the in-app
foundation only, never a faked integration.

### What's built now

- **`/invoices`** — a manual invoice log: supplier, amount, invoice/due
  dates, optional links to a `project` and/or `building`, status (Needed /
  Received / Filed / Paid / Disputed), notes, and an optional file
  attachment. The list is filterable by status and supplier and groupable
  by supplier or by building address — the same "clean stacked list"
  convention as Job Requests, not a scattered grid — so the future
  supplier- and job-organized folder structure already has a UI to browse
  it in. `source` is `'Manual Entry'` for everything entered here today.
- File attachments go through `lib/storage.ts#uploadInvoiceFile()`, the
  exact same soft-fail pattern as the Photos feature: it attempts a real
  Supabase Storage upload when a project is configured and otherwise the
  invoice is still saved with an honest "file storage isn't configured
  yet" notice — never a fabricated path.
- **`/invoices/rules`** — "Email Routing Rules": a configuration table
  (`email_routing_rules`) the owner can edit today that describes what a
  future email assistant should do when it sees a keyword — `keyword`,
  `action_type` (File As Invoice / Flag For Calendar / Flag For Review /
  Ignore), `route_by` (Supplier / Building Address / Manual/Case-by-Case),
  and an active toggle. A banner on the page states plainly that email
  isn't connected yet and invoices are entered manually until it is. Seed
  data includes 6 realistic rules (a generic `"invoice"` catch-all, `"site
  visit"` / `"walkthrough"` → Flag For Calendar, `"estimate request"` →
  Flag For Review, a known-supplier keyword `"Home Depot Pro"` → File As
  Invoice, and a `"past due"` review flag) plus 10 seed invoices tied to
  real suppliers/projects/buildings across every status, two of them
  marked `source = 'Email Auto-Routed'` to preview what an automated match
  would look like once wired up.

### What a future Gmail integration would need

1. A **Google Cloud OAuth app** with the **Gmail API** (read scope, to
   scan incoming mail) and the **Google Calendar API** (write scope, to
   create events for site-visit-type requests) enabled and consented to
   by the owner's account.
2. A **webhook or polling worker** (Gmail push notifications via Pub/Sub,
   or a scheduled poll of the inbox) that scans new mail's subject/body
   against `email_routing_rules.keyword` (case-insensitive substring match
   is enough to start).
3. On a match:
   - `action_type = 'Flag For Calendar'` → create a Google Calendar event
     (site visit, walkthrough) via the Calendar API.
   - `action_type = 'File As Invoice'` → parse what it can (supplier,
     amount, dates) and insert an `invoices` row with
     `source = 'Email Auto-Routed'`, organizing it by `route_by`
     (`Supplier` groups by the invoices list's supplier filter/grouping;
     `Building Address` matches the email against a building's name/
     address to set `related_building_id`).
   - `action_type = 'Flag For Review'` → surface it in a review queue
     (not built in this pass) rather than auto-filing.
   - `action_type = 'Ignore'` → no action.
4. Attachments would upload through the same `lib/storage.ts` path already
   used by manual entry, so the storage layer needs no changes.

**Case-by-case/manual review stays available indefinitely** regardless of
how much of the above ships — the manual "+ New Invoice" form and the
`route_by = 'Manual/Case-by-Case'` rule option are permanent parts of the
workflow, not just a placeholder until automation lands.

## QuickBooks Online Integration (build 10)

Connects the flooring dashboard (jobs, schedule, crew, labor, COI,
materials, completed-job history) to QuickBooks Online (accounting:
customers, estimates, invoices, payments) **without duplicating QuickBooks'
own job**. Follows the exact "architected but not live" pattern already
used by `lib/routing.ts` (real driving directions behind an env-var check)
and `lib/google-calendar.ts` (a real OAuth-shaped sync function that's
honestly inert with no credentials): every function in `lib/quickbooks.ts`
checks its configuration first, never throws an unhandled error, and never
fakes a success response. **No live Intuit OAuth handshake, sandbox API
call, or webhook has been exercised in this build** — there are no
credentials in this environment to do so with. Everything described below
as "real" is written to work correctly the moment credentials are added; it
just hasn't been (and can't be) executed here.

### What's built

- **Connection**: Settings → Company Setup → Integrations → QuickBooks
  (`app/company-setup/quickbooks/page.tsx`). Shows Not Connected / Connect
  QuickBooks (real Intuit OAuth 2.0 authorization-code redirect, see
  `app/api/quickbooks/auth/route.ts`), or once connected: Company, Environment,
  Connected, Last Sync, Sync Now, Disconnect. When `QUICKBOOKS_CLIENT_ID`/
  `_CLIENT_SECRET`/`_REDIRECT_URI` aren't set, the Connect button shows a
  clear "isn't configured yet" message instead of a broken redirect.
- **OAuth 2.0 callback**: `app/api/quickbooks/callback/route.ts` verifies a
  CSRF `state` cookie, exchanges the code for tokens
  (`lib/quickbooks.ts#exchangeCodeForTokens`), and persists the connection
  via `lib/db.ts`. Access/refresh tokens are stored **server-side only** —
  never read by a client component — via the same Supabase-or-in-memory
  data layer used everywhere else in this app; a real Supabase/Postgres
  project already encrypts these at rest, so no separate custom encryption
  layer was added on top (see `supabase/migrations/0011_quickbooks_integration.sql`).
- **Token refresh**: `lib/quickbooks.ts#refreshAccessToken` — a real,
  correct implementation of the refresh-token grant. Every API call in
  `lib/quickbooks.ts` auto-refreshes an expired token once and persists the
  rotated refresh token (Intuit rotates it on every refresh); a failed
  refresh flags the connection `needs_reconnect`, surfaced on the
  Integrations page as "QuickBooks Connection Needs Attention" / "Reconnect"
  rather than a broken page.
- **Customer mapping + matching UI**: `quickbooks_customer_mappings` links
  a `client_companies` row to a QuickBooks Customer. The matching screen
  shows fuzzy name-similarity "possible matches"
  (`lib/quickbooks.ts#fuzzyNameSimilarity` / `findCustomerMatchCandidates`)
  with **Link / Not the Same / Create New QuickBooks Customer** — never
  auto-linked. With no live connection, the screen renders an honest
  "Connect QuickBooks to see live customer matches" state rather than
  fabricated candidates (see `lib/seed-data.ts`); the Link/Create actions
  still call the real service layer, which returns a clear "not connected"
  result.
- **Job-centered documents**: `quickbooks_documents` maps every QB
  Estimate/Invoice to an internal `project_id`, one-to-many (a job can have
  multiple estimates and invoices — never a single
  `estimate_number`/`invoice_number` field on `projects`).
- **Prepare Estimate/Invoice**: `app/projects/[id]/quickbooks/prepare-estimate`
  and `prepare-invoice` — an editable review screen (customer, job, line
  items, total) that must be explicitly submitted before
  `createEstimate`/`createInvoice` is ever called. **There is no "Send"
  feature anywhere in this app** — creating/saving is the only action this
  app performs against QuickBooks; sending a document to a customer is
  exclusively done by a human inside QuickBooks itself. Job completion
  shows a "Prepare QuickBooks Invoice" prompt rather than auto-creating an
  invoice.
- **Link Existing Document**: `app/projects/[id]/quickbooks/link` — looks
  up a QB Estimate/Invoice by its internal ID and maps it to the job.
  Duplicate-mapping protection: a unique index on
  `(qb_realm_id, entity_type, qb_entity_id)`, backed by an application-level
  pre-check in `lib/db.ts#createQuickBooksDocument` so a retried call after
  a timeout can't silently create a second mapping.
- **Display**: the Project page's QuickBooks card lists linked documents
  (number, amount, status), each clickable via the best available deep
  link (see "Deep links" below). View Schedule and Completed Job Summary
  show the same documents **read-only**, inherited automatically via
  `project_id` — no manual entry fields on Create/Edit Schedule, no
  QuickBooks settings/editing controls on View Schedule
  (`lib/schedule.ts` threads `qbDocuments` through `ScheduleJobRow` and
  `CompletedJobSummary`; `components/quickbooks/QuickBooksDocumentList.tsx`
  is the one shared renderer).
- **Financial Summary**: added to the Project page and Completed Job
  Summary (`lib/financials.ts#computeFinancialSummary`,
  `components/quickbooks/FinancialSummaryCard.tsx`) — Estimated/Contract
  Value, Invoiced, Paid, Outstanding (from QuickBooks), Labor Cost (from
  the existing `lib/labor-cost.ts`), Other Tracked Costs, Total Tracked
  Cost, Gross Job Profit, Gross Margin. **Labor cost and QuickBooks invoice
  amounts are never computed from each other** — shown side by side,
  gated by the same `canViewLaborCost`/`canViewJobFinancials` tier so pay
  rates never leak onto a customer-facing estimate/invoice screen. When
  QuickBooks isn't connected, Invoiced/Paid/Outstanding show an honest "Not
  connected to QuickBooks" state instead of a misleading `$0`.
- **Webhooks**: `app/api/quickbooks/webhook/route.ts` verifies the
  `intuit-signature` header (HMAC-SHA256 keyed with
  `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`) against the **raw** body before
  doing anything else, rejecting unverified requests (401) or an
  unconfigured verifier (503). Idempotent: `quickbooks_webhook_events`
  records each event id before acting on it, so a redelivered notification
  is recognized and skipped.
- **Manual sync + Sync Log**: "Sync Now" (`app/company-setup/quickbooks/actions.ts#syncNowAction`)
  refreshes every linked document's status/amount. Every meaningful action
  (connected, disconnected, customer linked/created, estimate/invoice
  created/linked, sync run, webhook processed) is logged to both
  `quickbooks_sync_log` (admin-only view at
  `/company-setup/quickbooks/sync-log`) and the existing `activity_log`.
- **Permissions** (`lib/current-user.ts`, reusing the exact `access_role`
  concept from Labor Cost Tracking): Owner/Admin — everything, including
  connecting/disconnecting; Office Staff — view + create/link documents +
  sync, but **not** manage the connection itself; Field/Employee — no
  access, consistent with pay rates already being hidden from this role.

### Research findings (verified via web search, September 2026)

- **OAuth 2.0**: authorization URL `https://appcenter.intuit.com/connect/oauth2`,
  token URL `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`.
  Access tokens expire in ~1 hour; refresh tokens are valid ~100 days and
  are **rotated on every refresh**. Sources: developer.intuit.com "Set up
  OAuth 2.0" / "OAuth 2.0 Playground", help.developer.intuit.com "OAuth 2.0".
- **API base URLs**: sandbox
  `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}`,
  production `https://quickbooks.api.intuit.com/v3/company/{realmId}`.
  Customer/Estimate/Invoice all support `POST /{entity}` (create),
  `GET /{entity}/{id}` (read), `GET /query?query=...` (SQL-like query).
  Sources: developer.intuit.com "Develop" docs, help.developer.intuit.com
  "Where do I find out base URL?".
- **Webhooks**: signed with an `intuit-signature` header — HMAC-SHA256 of
  the raw body, keyed with the app's Webhooks "Verifier Token" from the
  Intuit Developer portal, base64-encoded.
  **Important**: Intuit has been retiring the legacy `eventNotifications`
  envelope in favor of the CNCF CloudEvents v1.0 format, with a cutover
  deadline of **July 31, 2026** — already past as of this build (today:
  September 2026). The signature mechanism is unaffected; only the
  envelope shape changed. `lib/quickbooks.ts#parseWebhookPayload` handles
  the CloudEvents shape as primary, with a defensive fallback parse of the
  legacy shape. Sources: help.developer.intuit.com "QuickBooks Webhooks";
  the Intuit Developer blog post on this migration (blogs.intuit.com,
  Nov 2025) could not be fetched directly in this environment — network
  egress to that domain is blocked — so its details were corroborated via
  independent secondary sources instead (Maesn "QuickBooks Webhooks to
  CloudEvents Migration Guide"; the `intuit/SampleApp-Webhooks-Java-Cloudevents`
  reference sample on GitHub).
- **Deep links**: QuickBooks Online does not publish a versioned,
  guaranteed "open this transaction by ID" API for third-party apps, but a
  long-standing web app URL pattern is documented in practice across
  Intuit community/help posts and integration vendors:
  `https://qbo.intuit.com/app/invoice?txnId={txnId}` and the equivalent
  `.../app/estimate?txnId={txnId}`, where `{txnId}` is the QBO entity's own
  `Id` (exactly what this app stores as `qb_entity_id` — never fabricated
  from the human-readable document number). This is the safest real link
  available (`lib/quickbooks.ts#buildQuickBooksDeepLink`); the document
  **number** is always shown alongside it regardless, since this format
  isn't part of Intuit's versioned API surface and could change.
- **Invoice payment status**: the QBO Invoice entity exposes `Balance`
  (amount still owed) and `TotalAmt`, not a first-class status enum — this
  app derives Paid/Partially Paid/Open from those two figures
  (`lib/quickbooks.ts#mapQBInvoiceStatus`), and tracks a Partially Paid
  invoice's `amount_paid` on the mapping row itself (Paid counts the full
  amount automatically) rather than modeling per-payment records, per the
  client's own simplification request.

### Going live — exact steps

1. **Create the Intuit Developer app**: sign in at
   [developer.intuit.com](https://developer.intuit.com) with the business's
   Intuit account, go to **Dashboard → Create an app → QuickBooks Online
   and Payments**, and give it a name.
2. **Get credentials**: in the app's **Keys & OAuth** tab, copy the
   **Sandbox** Client ID/Secret first (to test safely) — Production
   credentials appear on the same tab once the app passes Intuit's review.
3. **Register the Redirect URI**: still on **Keys & OAuth**, add this
   exact URL under Redirect URIs (matching this app's real deployed
   domain): `https://<your-vercel-domain>/api/quickbooks/callback`.
4. **Register the webhook**: in the app's **Webhooks** tab, set the target
   URL to `https://<your-vercel-domain>/api/quickbooks/webhook`, subscribe
   to the `Estimate` and `Invoice` entities, and copy the **Verifier
   Token** shown there.
5. **Set the environment variables** in the Vercel project's Settings →
   Environment Variables:
   - `QUICKBOOKS_CLIENT_ID` — from step 2
   - `QUICKBOOKS_CLIENT_SECRET` — from step 2
   - `QUICKBOOKS_REDIRECT_URI` — exactly the URL registered in step 3
   - `QUICKBOOKS_ENVIRONMENT` — `sandbox` to start (see step 6)
   - `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` — from step 4
6. **Start in Sandbox**: leave `QUICKBOOKS_ENVIRONMENT=sandbox` and use the
   Sandbox Client ID/Secret first. Connect to a free Sandbox company
   (developer.intuit.com → **Sandboxes**) from Settings → Integrations →
   QuickBooks, create a test estimate/invoice, and confirm Sync Now and
   the webhook both behave as expected — **before** switching to
   Production credentials and `QUICKBOOKS_ENVIRONMENT=production`.
7. **Realm ID**: never set as an env var — it's returned by Intuit on the
   OAuth callback (`realmId` query param) for whichever company the user
   authorized, and stored per-connection in `quickbooks_connections`.

## Permissions & Staff Access (build 11)

The client, in his own words: *"I need to be able to give everyone their
own access. My friend will have the owner access and then he can select
what staff members can or cant see. Some of the project managers only
need to be able to see and or edit certain things so i need options for
what they can do and if they can edit also."* Two decisions were made with
the client up front: (1) login method = email + password, not magic link;
(2) permission granularity = per-nav-section **None / View / Full-Edit**,
set per staff member by the Owner/Admin.

### Data-model decision: extending `office_users`, not a new `staff_accounts` table

`office_users` (added in `0002_bid_workflow.sql`, extended once already in
`0006_labor_cost_tracking.sql` with `access_role`) already **is** this
app's staff-accounts table: every acting-user persona the dev selector can
switch to (`lib/current-user.ts#listActingUserOptions`) is already backed
by a row here, and it already has `full_name`/`email`/`role`/`active`. Its
`role` column name (`estimator`/`manager`) is a legacy holdover from the
bid-claim workflow, not a scope limitation. `0012_permissions_and_auth.sql`
extends it with:

- `auth_user_id` (nullable text) — will hold the real Supabase Auth user's
  id once "Add Staff Account" creates one. Null for everyone today.
- `is_owner` (boolean) — unrestricted, full-edit access to **every**
  section, always, per the client's description of his friend's Owner
  access. Not subject to the `section_permissions` grid at all.
- A unique index on `email` (nullable-safe — only enforced once set),
  needed for real email+password sign-in later.

A second `staff_accounts` table was considered and rejected: it would fork
the staff directory in two and require a join at every one of the many
existing `office_users` read sites for no benefit.

### `section_permissions` — the new fine-grained layer

One row per (staff member, nav section) with the access level the
Owner/Admin has granted:

```
section_permissions(
  id, company_id, office_user_id, section_key, access_level, updated_by, updated_at
)
```

`access_level` is `none | view | edit`. **No row for a (user, section) pair
means `none`** — secure by default, so a brand-new staff account sees
nothing until the Owner/Admin explicitly grants access. `section_key`
matches `lib/types.ts` `SECTION_KEYS`, which mirrors the real nav
destinations in `components/nav-items.ts` one-for-one, plus `quickbooks`
(a sub-route of Company Setup that already had its own access_role gate —
see below).

### How this relates to the existing `access_role` tier

Both layers stay, and both apply where they overlap — the more
restrictive one wins:

| Layer | Governs | Set by |
|---|---|---|
| `access_role` (`owner_admin`/`office_staff`/`field_employee`, build 6) | A handful of specific **sensitive sub-features** regardless of section access: editing pay rates (`canEditPayRates`), viewing labor-cost dollar figures (`canViewLaborCost`), managing the QuickBooks **connection** itself (`canManageQuickBooksConnection`) | Set on the office_user row directly (Company Setup → Staff Access edit page) |
| `section_permissions` (build 11) | Whether a user can **open a nav section at all**, and whether they can create/edit/delete inside it | Owner/Admin, per staff member, per section — Company Setup → Staff Access |

Concretely: an `office_staff`-tier user with `edit` on the `staff` section
can add employees and manage capabilities, but still can't see or edit pay
rates unless their `access_role` is also `owner_admin`. Same pattern on
the QuickBooks page: `canViewQuickBooks`/`canManageQuickBooksConnection`
(access_role) AND `section_permissions.quickbooks` (new layer) are both
checked — either one denying is a denial (`app/company-setup/quickbooks/page.tsx`).

`is_owner` short-circuits both: an Owner/Admin's `getSectionAccess()`
always returns `edit` without even querying `section_permissions`
(`lib/permissions.ts#getSectionAccessFor`), matching the access_role
`owner_admin` tier's existing "sees everything" behavior.

### The permission engine (`lib/permissions.ts`)

- `getSectionAccess(sectionKey)` / `getSectionAccessFor(actingUser, sectionKey)` — the
  core lookup: `is_owner` (or the dev "acting as" Owner/Manager sentinel) →
  `edit`; otherwise looks up `section_permissions`, defaulting to `none`.
- `canView(sectionKey)` / `canEdit(sectionKey)` — booleans for the current
  acting user, used exactly like the existing `canViewLaborCost`-style
  checks throughout the app.
- `getAllSectionAccess(actingUser)` — every section's level in one pair of
  lookups, used by the nav (hide sections) and the staff-access edit grid
  (pre-fill current values) instead of N separate calls.
- `requireSectionAccess(sectionKey)` — the route-guard entry point every
  section's `page.tsx` calls in one line (see below).
- `isOwnerActingUser()` — gates the staff-access management UI itself:
  true for the dev Owner/Manager sentinel or an `is_owner` office_user row;
  a plain `access_role: 'owner_admin'` tier does **not**, by itself, grant
  staff-access management — only an explicit Owner flag does.

### Enforcement

Three layers, in order of how much they actually protect:

1. **Server-action gating (the real security boundary)** — every major
   section's create/edit/delete server actions (`app/*/actions.ts`) call
   `canEdit(sectionKey)` (or the section-specific check, e.g. QuickBooks'
   actions check both the existing `access_role` gate and the new section
   gate) and silently no-op when it fails. This is what actually stops a
   view-only user from writing data — hiding a button is not a security
   boundary by itself.
2. **Route guards** — each section's `page.tsx` calls
   `requireSectionAccess(sectionKey)` in its first line and renders the
   shared `<AccessDenied section="..." />` component when the result is
   `'none'`, instead of the page content. This is the least-invasive
   pattern for ~14 sections: one line per page, one reusable component,
   rather than a bespoke empty state per section.
3. **Nav hiding** — `app/layout.tsx` computes the acting user's full
   access map once per request (`getAllSectionAccess`) and passes it to
   `Sidebar`/`MobileNav`, which filter out any nav item whose section
   resolves to `'none'` — a staff member with no access to a section
   doesn't even see it listed.

`'view'`-only pages hide their Create/Edit/Delete controls in the UI, but
the server action behind each one is the actual enforcement — see (1).
Given the size of this surface (~14 sections), the create actions for
every section are gated; a handful of secondary per-row actions inside
larger sections (e.g. individual schedule-day field updates) reuse the
same section's `canEdit` check rather than each having a bespoke one.

### Owner/Admin staff-access management UI

`/company-setup/staff-access` (linked from Company Setup, visible only
when `isOwnerActingUser()` is true):

- **List** — every `office_users` row: name, email, access-role tier,
  Owner flag, active/inactive, with a link to each one's edit page.
- **+ Add Staff Account** — name, email, bid-claim role, access-role tier,
  and a full section × None/View/Edit grid (`StaffAccessGridFields.tsx`),
  all set at creation time via `createStaffAccountAction`.
- **Per-account edit page** (`/company-setup/staff-access/[id]`) —
  auto-submitting None/View/Edit selects per section
  (`SectionAccessRow.tsx`, same "select → auto-submit hidden form"
  pattern as `ActingUserSelector.tsx`), plus buttons to
  activate/deactivate the account, change the legacy access-role tier, and
  **grant/revoke Owner status**. Every action re-checks
  `isOwnerActingUser()` server-side — the page being Owner-gated is not
  itself the security boundary, `app/company-setup/staff-access/actions.ts`
  is.

### Audit logging

Every staff-account change and every section-permission change is logged
to the existing `activity_log` table via `lib/db.ts`'s `logActivity()`
helper (the same one used by pay-rate edits, crew assignment changes,
etc.): `createOfficeUser`/`updateOfficeUser` log who added/changed which
account and what changed; `setSectionPermission` logs the office user
name, the section key, and the **old value → new value** transition, plus
who made the change and when.

### Seed data — demonstrating the client's exact scenario

The 3 existing office users (`0006_labor_cost_tracking.sql`) now also
demonstrate the requested access-tier scenarios:

| Staff member | `is_owner` | Section access |
|---|---|---|
| Sarah Bennett | **true** | Everything, unrestricted — "my friend" |
| Emma Castillo | false | `edit` on every operational section (Dashboard through Reports); `view` only on Company Setup / QuickBooks |
| David Okoye | false | `view` only, and only on Dashboard, Schedule, Projects, Tasks — the "PM only needs to see certain things" persona; everything else defaults to `none` |

Switch between them with the TopBar's "Acting as" selector to see the
nav-hiding, route guards, and server-action gating live.

### Activating Real Login (`lib/auth.ts`)

**Status as of build 12: fully built and wired, not yet flipped on.** A
real Supabase project (`fbciqsucmuxdggpjjxrg`) is connected, with all
migrations applied and seed data loaded — `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are all
confirmed present. Real Supabase Auth code paths exist and compile/build
cleanly, and route protection was verified end-to-end against a local
build (`curl` against `/dashboard` with `NSF_REAL_AUTH_ENABLED=true` set
and no session cookie returns a 307 to `/login`; `/login` itself and
`/api/*` are unaffected) — but a real sign-in has never been exercised
against the live Supabase project, because this environment has no network
access to `*.supabase.co`. See the manual test checklist at the end of
this section for exactly what to do once deployed.

- **`lib/supabase/server.ts`** — `createSupabaseServerClient()`, a
  `@supabase/ssr` `createServerClient` factory reading/writing the Next.js
  cookie store, for Server Components / Server Actions / Route Handlers.
  Returns `null` if the public URL/anon key env vars aren't set.
- **`lib/supabase/middleware.ts`** — `updateSession()`, the standard
  `@supabase/ssr` session-refresh pattern, called from the root **`proxy.ts`**
  (this Next.js version renamed `middleware.ts` → `proxy.ts` — see
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`;
  same behavior, new file/export names). Also enforces route protection:
  when real auth is configured, any page other than `/login` (API routes
  are left alone — they have their own auth/secret handling) redirects to
  `/login` when there's no Supabase Auth session.
- **`lib/supabase/admin.ts`** — `getSupabaseAdminClient()`, a
  `SUPABASE_SERVICE_ROLE_KEY`-backed client marked `import "server-only"`
  so any accidental client-side import is a build error, not a leaked
  secret. Used only for `supabase.auth.admin.*` calls.
- **`lib/auth.ts#getCurrentSession()`** is the one function real
  pages/actions call instead of `lib/current-user.ts`'s dev "acting as"
  cookie mechanism directly. When real auth isn't configured, it's
  byte-for-byte the same demo fallback as before. When it is: reads the
  Supabase session via `createSupabaseServerClient()`, looks up the
  matching `office_users` row by `auth_user_id`
  (`lib/db.ts#getOfficeUserByAuthId()`), and returns `null` — never a
  default Owner persona — when there's no session or no matching account.
- **`lib/current-user.ts#getActingUser()`** — the function ~30 call sites
  across the app actually use — now routes through `getCurrentSession()`
  when real auth is configured, and returns a fully-locked-out
  `noMatchingAccountUser()` persona (not Owner, not a crash) when a real
  session has no matching `office_users` row. When real auth isn't
  configured, this is unchanged: it reads the dev "acting as" cookie
  directly, same as always.
- **`/login`** (`app/login/page.tsx` + `actions.ts`) — demo mode is
  unchanged (honest "not connected yet" message, hands off to the dev
  selector). With real auth configured, the same form calls
  `supabase.auth.signInWithPassword()` server-side and redirects to
  `/dashboard` on success, or back to `/login?mode=error` (a single
  generic "Invalid email or password", never revealing whether the email
  exists) on failure. A **Sign Out** button (`signOutAction`, calling
  `supabase.auth.signOut()`) appears in the TopBar once a real session
  exists.
- **"Add Staff Account"** (`app/company-setup/staff-access/actions.ts`)
  now additionally calls `supabase.auth.admin.createUser()` (with
  `email_confirm: true` and a randomly generated temporary password —
  `inviteUserByEmail()` was deliberately not used, since this app has no
  real email-sending configured anywhere yet and an invite email would
  never arrive) when real auth is configured and an email was given, and
  stores the returned auth user id onto `office_users.auth_user_id`. The
  temporary password is shown once in the UI, clearly labeled, for the
  Owner/Admin to relay directly.
- **Per-account "Real Login" section**
  (`app/company-setup/staff-access/[id]/page.tsx`) — for a row that
  already has an email but no real account yet (true for all three seeded
  office_users, which predate real auth), a **"Create Real Login Account"**
  button does the same `createUser()` call. For a row that already has one,
  a **"Set New Password"** button calls
  `supabase.auth.admin.updateUserById(uid, { password })` to reset a
  locked-out staff member's password. Both show the resulting temporary
  password once, the same way "Add Staff Account" does.
- **The dev "acting as" selector** (`ActingUserSelector.tsx`, in
  `components/TopBar.tsx`) is untouched when real auth isn't configured —
  same unconditional rendering as always. Once real auth IS configured, it
  hides for everyone except an `is_owner` user, for whom it stays visible
  as a "preview as" debugging override, exactly as this section previously
  said it would.
- **Schema**: `0012_permissions_and_auth.sql`'s
  `office_users.email`/`auth_user_id` were already sufficient for the
  lookup itself. The one genuine gap found: `auth_user_id` had no index,
  so every authenticated request's `getOfficeUserByAuthId()` lookup would
  force a sequential scan — `0013_auth_user_id_index.sql` adds a partial
  unique index on `office_users(auth_user_id) where auth_user_id is not
  null`. **This migration has not been applied yet** — it needs to be run
  against the live `fbciqsucmuxdggpjjxrg` project (via the Supabase MCP
  tools or `supabase db push`) before flipping `NSF_REAL_AUTH_ENABLED=true`
  in production.
- Add Supabase RLS policies scoped to `auth.uid()` as defense-in-depth on
  top of the app-level `section_permissions`/`access_role` checks that
  already exist — not yet done (same recommendation as the pre-existing
  "How auth will be added later" note below).

#### Turning it on, and the exact first-login test

1. Apply `supabase/migrations/0013_auth_user_id_index.sql` against the live
   project (not yet applied as of this writing).
2. Set `NSF_REAL_AUTH_ENABLED=true` in the Vercel project's environment
   variables and redeploy (the three `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` vars should
   already be set from connecting the project).
3. **No real Supabase Auth account exists yet against the live project** —
   nothing has created one from this sandboxed environment (no network
   access to `*.supabase.co` here). So the very first real login has to be
   created manually:
   - As the seeded Owner (Sarah Bennett, `sbennett@nolanselectfloors.com`)
     using the dev "acting as" selector (still visible pre-flip, or
     visible post-flip if she's `is_owner`), go to Company Setup → Staff
     Access → open her own row (or Emma Castillo's, or David Okoye's) →
     "Real Login" → **Create Real Login Account**.
   - Copy the one-time temporary password shown.
   - Go to `/login`, sign in with that email + temporary password.
   - Confirm: redirected to `/dashboard`, the TopBar shows a **Sign Out**
     button, and the dev "acting as" selector is hidden (or shown only if
     signed in as the `is_owner` account).
   - Confirm section access is enforced correctly for that person's role
     (e.g. David Okoye — view-only on Dashboard/Schedule/Projects/Tasks,
     no access elsewhere) by trying a restricted page.
   - Sign out, confirm landing back on `/login`, and confirm visiting
     `/dashboard` directly without a session redirects to `/login`.
   - From the Owner's staff-access page, try **Set New Password** on that
     same account and confirm the new password signs in (and the old one
     no longer does).
   - Try **Add Staff Account** with a brand-new email end-to-end.

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase project URL — **confirmed set** for the connected `fbciqsucmuxdggpjjxrg` project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Public anon key — used for reads AND now for real Supabase Auth sessions (`lib/supabase/server.ts`, `lib/supabase/middleware.ts`) — **confirmed set** |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side writes, and now the Supabase Admin API (`lib/supabase/admin.ts` — create/reset staff accounts) — **confirmed set** |
| `SUPABASE_PHOTOS_BUCKET` | No | Storage bucket name for project photos (default `project-photos`) |
| `ROUTING_PROVIDER` | No | `google` or `mapbox` — enables live driving routes on the Haul-Away Run page |
| `GOOGLE_MAPS_API_KEY` | No | Required when `ROUTING_PROVIDER=google` — get one at console.cloud.google.com (enable "Directions API") |
| `MAPBOX_ACCESS_TOKEN` | No | Required when `ROUTING_PROVIDER=mapbox` — get one at account.mapbox.com/access-tokens |
| `QUICKBOOKS_CLIENT_ID` | No | Intuit Developer app's Client ID — see "QuickBooks Online Integration" below |
| `QUICKBOOKS_CLIENT_SECRET` | No | Intuit Developer app's Client Secret — server-side only, never sent to the browser |
| `QUICKBOOKS_REDIRECT_URI` | No | Must exactly match a Redirect URI registered on the Intuit app |
| `QUICKBOOKS_ENVIRONMENT` | No | `sandbox` (default) or `production` |
| `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` | No | From the Intuit app's Webhooks subscription page — verifies `intuit-signature` |
| `NSF_REAL_AUTH_ENABLED` | No | Set to `true` once real Supabase Auth accounts exist (see "Permissions & Staff Access" → "Activating Real Login") — flips `lib/auth.ts#isRealAuthConfigured()` on |

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

See also "Permissions & Staff Access" → "Activating Real Login" above,
which is the up-to-date, detailed version of this note as of build 11
(`lib/auth.ts`, the `/login` stub, and exactly what "Add Staff Account"
would do differently once a real Supabase project is connected). This
section is kept for the original build-1 context:

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

- **Vacation & Sick Day Tracker (build 7)** — a day-off LOG, not an
  accrual/balance system: no monthly accrual, no rollover, no pro-rating
  by hire date. Allowance is a flat "N days per calendar year" set once
  per employee, compared against a year-to-date sum — see README
  "Vacation & Sick Day Tracker — Annual Allowance". Editing an existing
  time-off entry isn't exposed in the UI (`lib/db.ts#updateTimeOffEntry`
  exists and is ready to wire to one); the "+ Add" / "Remove" pair covers
  the common corrections with far less UI, same call as the Labor Cost
  phase's actual-hours entries above. There's also no real email/push
  notification when someone goes over their allowance — the in-app
  banner/badge/inline-warning IS the notification for now, same "not yet
  live" treatment as the Email Assistant / Invoice Routing rules below.
- **File uploads** — `documents` and `photos` tables and their UI exist
  and are wired to real (seed) data, but there is no working upload
  pipeline. A real implementation would add a Supabase Storage bucket per
  table and an upload route; the UI notes this clearly wherever a file
  action would normally live.
- **Schedule Day/Week/Month views** — all three are built (see "Schedule
  Redesign" above); they share one route (`/schedule?view=day|week|month`)
  rather than three separate page files, since they all read the same
  `buildScheduleJobRows()` view model and a query param is simpler than
  three near-identical layout shells for this app's scale.
- **Actual-hours entry editing** — entries can be added and deleted from
  the End of Day Review, but there's no in-place "edit an existing entry's
  hours" form; `lib/db.ts#updateActualLaborEntry()` exists and is ready to
  wire to one, but deleting and re-adding covers the same real-world
  correction ("I mis-typed the hours") with far less UI for a first pass.
- **Weekend days on the Weekly view** — rendered like any other day (the
  underlying data has no special-cased weekday filtering), but the current
  seed data's weekday-only crews mean Saturday/Sunday mostly show as
  empty unless a Saturday push (like the seeded `p-11` time-and-half day)
  is scheduled.
- **Communications log** — the `communications` table and seed rows exist
  and are used on a couple of detail views, but there's no dedicated
  standalone communications page in this pass.
- **A live Supabase project (`fbciqsucmuxdggpjjxrg`) is connected** as of
  build 12, with all migrations applied and seed data loaded — but this
  sandboxed dev environment itself has no network access to
  `*.supabase.co`, so real Supabase Auth sign-in has been verified by code
  review and a local build/route-protection test, not a live smoke test
  (see "Activating Real Login" → "Turning it on, and the exact first-login
  test" for what to do once deployed). The app still builds and runs
  entirely on the in-memory seed fallback with zero credentials, matching
  the original hard requirement.
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
- **Labor cost access control is UI-level only** — like every permission
  check in this app (bid claiming, reassign/release), `canViewLaborCost`/
  `canEditPayRates` hide fields/sections for a disqualified acting user;
  there is no session/API-level enforcement yet (no real auth exists — see
  "How auth will be added later"). See "Labor Cost Tracking" above.
- **No separate rate-history table** — the spec explicitly allows this:
  `actual_labor_entries.rate_type`/`rate_amount` already snapshots the rate
  that mattered for every historical entry, so a full audit trail is just
  `activity_log` (old rate → new rate, who, when) plus those per-entry
  snapshots, not a third table tracking every rate over time.
- **New Staff form's pay-rate section is hidden, not disabled, for a
  non-Owner/Admin acting user** — a new hire created by Office Staff or
  below gets a sane daily-rate default (mirroring the legacy `day_rate`
  field) that an Owner/Admin can then set correctly from the profile,
  rather than showing a rate input that silently wouldn't save.
- **Duplicate-check UX is a full-page round trip, not client-side** — the
  New Job Request form re-checks for duplicates as a server action and
  redirects back with the warning + prefilled fields, instead of a
  client-side fetch/modal. This keeps the whole flow working with zero
  client JS, consistent with how every other form in this app already
  works, at the cost of one extra page load when a duplicate is found.
- **Drawings "supersede" picker is a dropdown of current drawings, not a
  search/autocomplete** — with a handful of drawings per project this is
  plenty; a project with dozens of drawings would eventually want to
  filter/search that list, but nothing in the spec called for it yet.
- **No real image/PDF rendering for Photos or Drawings** — per the task's
  own framing ("this is a demo app without live file storage… focus on the
  correct data model, UI, and organization"), both features show honest
  metadata + a "storage not configured" notice rather than a broken
  `<img>`/`<iframe>` or a faked preview. See "Photos & Drawings" above for
  exactly what a real Supabase Storage connection would unlock with no
  schema change.
- **"New Job" nav item and the in-section "+ New Job Request" button are
  two links to the one form, not two forms** — this was the explicit ask
  (a more discoverable entry point, not a second flow); see "New Job —
  Top-Level Nav Entry Point" above.

## First-time password setup (self-serve, no invite email)

Staff never receive an invite email and the owner never relays a temporary
password. Instead:

1. The Owner/Admin adds the person under **Company Setup → Staff Access**
   (their email is their username) and sets one shared **staff setup code**
   on that same page (stored in `companies.staff_setup_code`, migration
   `0015_staff_setup_code.sql`).
2. The person opens `/login` → **Set up your password**, enters their email,
   the setup code, and a password of their choosing (`app/login/actions.ts`
   → `setupPasswordAction`). That creates and links the real Supabase Auth
   account and signs them straight in.
3. Once any account has a password, real login is enforced for everyone
   (the bootstrap window in `lib/supabase/middleware.ts` closes), so the
   owner should set up their own account first.

The code is what stops a stranger who merely knows a staff email from
claiming the account; a wrong code and an unknown email produce the same
generic message. **Set New Password** on a person's access page remains the
reset path. There is no rate limiting on setup attempts yet — rotate the
code from Staff Access if it ever leaks.
