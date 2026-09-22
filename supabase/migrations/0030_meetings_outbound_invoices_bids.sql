-- Meetings on the schedule: a day entry can be flagged as a meeting with a
-- time. Meetings still sit on the schedule (Yellow) but never count as a
-- job to invoice.
alter table project_schedule_days add column if not exists is_meeting boolean not null default false;
alter table project_schedule_days add column if not exists meeting_time text;

-- Outbound invoices (the ones WE send the customer), filed from Email
-- Inbox. A new one replaces the current one; older ones stay as history.
create table if not exists project_outbound_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  project_id uuid not null references projects(id) on delete cascade,
  file_reference text,
  file_name text,
  amount numeric(12,2),
  invoice_number text,
  invoice_date date,
  source_email_id uuid,
  is_current boolean not null default true,
  uploaded_by text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists project_outbound_invoices_project_idx on project_outbound_invoices(project_id);
alter table project_outbound_invoices enable row level security;

-- Purchase orders and potential bids are filed inbound emails
-- (filed_kind = 'purchase_order' / 'bid'); bids carry a small status.
alter table inbound_emails add column if not exists bid_status text;
alter table inbound_emails add column if not exists bid_notes text;
