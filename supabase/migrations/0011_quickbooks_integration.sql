-- Nolan Select Floors — QuickBooks Online Integration (build 10)
--
-- Connects the flooring dashboard (jobs, schedule, crew, labor, COI,
-- materials, completed-job history) to QuickBooks Online (accounting:
-- customers, estimates, invoices, payments) WITHOUT duplicating QuickBooks'
-- job. See README "QuickBooks Online Integration" and lib/quickbooks.ts for
-- the full write-up, including citations for the current (as of this
-- build, September 2026) Intuit OAuth 2.0 + QuickBooks Online API behavior
-- this schema and service layer were built against.
--
-- Every table here is additive — nothing in this migration touches
-- `projects`, `project_schedule_days`, or any existing table. A project can
-- have MULTIPLE linked estimates/invoices (one-to-many via
-- quickbooks_documents.project_id), never a single estimate_number/
-- invoice_number column on `projects` itself.

-- =========================================================================
-- CONNECTION — one row per company per QuickBooks realm (company file).
-- access_token/refresh_token are stored here, server-side only (see
-- lib/current-user.ts / lib/quickbooks.ts — never sent to a client
-- component). On a real Supabase/Postgres project these are encrypted at
-- rest by the platform already; this migration does not add a second,
-- custom encryption layer on top (see README "Security" for why).
-- =========================================================================
create table quickbooks_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  realm_id text not null,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  environment text not null check (environment in ('sandbox', 'production')),
  company_name text,
  connected_at timestamptz not null default now(),
  connected_by text,
  disconnected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_quickbooks_connections_company on quickbooks_connections(company_id);
-- One ACTIVE (not yet disconnected) connection per company+realm.
create unique index idx_quickbooks_connections_active
  on quickbooks_connections(company_id, realm_id)
  where disconnected_at is null;

-- =========================================================================
-- CUSTOMER MAPPING — management_companies (client_companies in this app's
-- schema) <-> QuickBooks Customer. Never auto-linked from a fuzzy name
-- match alone — see lib/quickbooks.ts findCustomerMatchCandidates() and the
-- Settings -> Integrations -> QuickBooks matching UI.
-- =========================================================================
create table quickbooks_customer_mappings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_company_id uuid not null references client_companies(id) on delete cascade,
  qb_customer_id text not null,
  qb_customer_name text not null,
  linked_at timestamptz not null default now(),
  linked_by text,
  created_at timestamptz not null default now()
);
create unique index idx_qb_customer_mappings_client on quickbooks_customer_mappings(company_id, client_company_id);
create unique index idx_qb_customer_mappings_qb_customer on quickbooks_customer_mappings(company_id, qb_customer_id);

-- =========================================================================
-- DOCUMENTS — the one place every QB Estimate/Invoice maps to an internal
-- project/job. A job can have MANY estimates and invoices (one-to-many),
-- never a single estimate_number/invoice_number field on `projects`.
-- `status` mirrors whatever QBO calls it — modeled as our own enum informed
-- by the QBO API's documented Estimate/Invoice status values (see
-- lib/quickbooks.ts QB_ESTIMATE_STATUSES / QB_INVOICE_STATUSES and README).
-- `amount_paid` is tracked at the invoice-status level per the client spec
-- (QBO's Invoice API exposes Balance/TotalAmt on the entity itself rather
-- than a simple "amount paid" field — see README for exactly what was
-- found): a Paid invoice counts its full amount as paid, a Partially Paid
-- invoice needs this field set explicitly (by sync or manual entry).
-- =========================================================================
create table quickbooks_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  qb_realm_id text not null,
  entity_type text not null check (entity_type in ('Estimate', 'Invoice')),
  qb_entity_id text not null,
  document_number text,
  status text not null,
  amount numeric(12,2) not null default 0,
  amount_paid numeric(12,2),
  qb_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz
);
create index idx_qb_documents_project on quickbooks_documents(project_id);
create index idx_qb_documents_company on quickbooks_documents(company_id);
-- DUPLICATE PROTECTION: the same QB entity can never be mapped twice,
-- whether by a retried "Create" call after a timeout or by "Link Existing"
-- being run twice against the same document.
create unique index idx_qb_documents_unique_entity
  on quickbooks_documents(qb_realm_id, entity_type, qb_entity_id);

-- =========================================================================
-- WEBHOOK EVENTS — idempotency ledger for app/api/quickbooks/webhook. A
-- duplicate delivery of the same event_id (Intuit retries webhooks on a
-- non-2xx response, and may redeliver) is recognized and skipped rather
-- than double-processed.
-- =========================================================================
create table quickbooks_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload_summary text
);

-- =========================================================================
-- SYNC LOG — every meaningful QuickBooks action (connected, disconnected,
-- customer linked/created, estimate/invoice created/linked, sync run,
-- webhook processed), shown in an admin-only Sync Log view. ALSO logged to
-- the existing `activity_log` for consistency with the rest of the app's
-- audit trail (see lib/quickbooks.ts / lib/db.ts) — this table is the
-- QuickBooks-specific detail view, not a replacement for activity_log.
-- =========================================================================
create table quickbooks_sync_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  action text not null,
  project_id uuid references projects(id) on delete set null,
  entity_type text check (entity_type in ('Estimate', 'Invoice')),
  qb_entity_id text,
  document_number text,
  success boolean not null default true,
  error_detail text,
  initiated_by text
);
create index idx_qb_sync_log_company on quickbooks_sync_log(company_id);
create index idx_qb_sync_log_project on quickbooks_sync_log(project_id);
