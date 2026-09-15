-- Nolan Select Floors — pricing/estimating formulas + invoice routing
-- architecture. Deliberately additive: no existing table dropped or
-- renamed, no existing column repurposed. See lib/types.ts for the
-- matching TypeScript shapes, lib/pricing.ts for the calculation logic,
-- and lib/seed-data.ts for the backfilled demo data.

-- =========================================================================
-- PRICING & ESTIMATING FORMULAS
-- =========================================================================

create type material_rate_category as enum (
  'Material', 'Underlayment', 'Adhesive', 'Trim', 'Other'
);

-- Reusable priced line items a pricing formula can reference (hardwood,
-- underlayment, glue, carpet padding, etc). `supplier` is a plain text
-- field for V1 rather than a suppliers table/FK — good enough to group by
-- and to overlap with invoices.supplier for the "grouped by supplier"
-- views described in the README.
create table material_rate_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  unit text not null default 'sqft', -- sqft / linear ft / gallon / box / each / ...
  unit_cost numeric(10,2) not null default 0,
  supplier text,
  category material_rate_category not null default 'Material',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_material_rate_items_company on material_rate_items(company_id);
create index idx_material_rate_items_category on material_rate_items(category);

-- One pricing formula per work type (or a named formula tied to a work
-- type) — labor rate + markup, with component line items below.
create table pricing_formulas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  work_type work_type not null,
  labor_rate_per_sqft numeric(10,2),
  markup_percent numeric(6,2),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_pricing_formulas_company on pricing_formulas(company_id);
create index idx_pricing_formulas_work_type on pricing_formulas(work_type);

-- Line items within a formula. `quantity_per_unit_area` multiplies against
-- the job's total square footage to get the quantity needed (e.g. 1.05 for
-- 5% waste factor on hardwood, or 0.01 for "1 unit of glue per 100 sqft").
create table pricing_formula_components (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  formula_id uuid not null references pricing_formulas(id) on delete cascade,
  material_rate_item_id uuid not null references material_rate_items(id) on delete cascade,
  quantity_per_unit_area numeric(10,4) not null default 1,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_pricing_formula_components_formula on pricing_formula_components(formula_id);
create index idx_pricing_formula_components_item on pricing_formula_components(material_rate_item_id);

-- Optional estimated value on a job request, populated when the office
-- saves a computed suggested price from the Estimate Calculator before the
-- job has an actual `estimate_amount` recorded (see lib/pricing.ts +
-- app/job-requests/[id]/page.tsx). Kept separate from `estimate_amount`
-- (which represents the amount actually sent to the client) so a saved
-- calculator estimate never silently overwrites a real sent estimate.
alter table job_requests
  add column estimated_value numeric(12,2);

-- =========================================================================
-- INVOICE ROUTING ARCHITECTURE (foundation for a future Gmail-based
-- assistant — NOT live email integration; see README)
-- =========================================================================

create type invoice_status as enum ('Needed', 'Received', 'Filed', 'Paid', 'Disputed');
create type invoice_source as enum ('Manual Entry', 'Email Auto-Routed');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  supplier text not null,
  amount numeric(12,2),
  invoice_date date,
  due_date date,
  related_project_id uuid references projects(id) on delete set null,
  related_building_id uuid references buildings(id) on delete set null,
  status invoice_status not null default 'Needed',
  source invoice_source not null default 'Manual Entry',
  -- Placeholder for a future Supabase Storage path — same soft-fail
  -- pattern as photos.storage_path / storage_unavailable.
  file_reference text,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_invoices_company on invoices(company_id);
create index idx_invoices_supplier on invoices(supplier);
create index idx_invoices_status on invoices(status);
create index idx_invoices_related_project on invoices(related_project_id);
create index idx_invoices_related_building on invoices(related_building_id);

create type email_routing_action as enum (
  'File As Invoice', 'Flag For Calendar', 'Flag For Review', 'Ignore'
);
create type email_routing_by as enum (
  'Supplier', 'Building Address', 'Manual/Case-by-Case'
);

-- Configuration table the owner can edit today, describing what a future
-- Gmail-connected assistant should do when it sees a keyword in an email.
-- Nothing processes live email yet — see README "Email Assistant &
-- Invoice Routing" section.
create table email_routing_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  keyword text not null,
  action_type email_routing_action not null default 'Flag For Review',
  route_by email_routing_by not null default 'Manual/Case-by-Case',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_email_routing_rules_company on email_routing_rules(company_id);
