-- Emails forwarded from the office Gmail into the app's intake address.
-- Attachments are copied to Supabase Storage (bucket "inbound-email");
-- each email is auto-filed to a job when the match is certain, otherwise
-- it waits in the Unfiled tray. Idempotent.
create table if not exists inbound_emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  provider_email_id text not null unique,
  from_email text,
  from_name text,
  to_email text,
  subject text,
  text_preview text,
  received_at timestamptz not null default now(),
  kind text not null default 'unknown',          -- drawing | invoice | unknown
  status text not null default 'unfiled',        -- unfiled | filed | ignored
  suggested_building_id uuid references buildings(id) on delete set null,
  suggested_project_id uuid references projects(id) on delete set null,
  filed_project_id uuid references projects(id) on delete set null,
  filed_kind text,
  filed_by text,
  filed_at timestamptz,
  attachments jsonb not null default '[]'::jsonb, -- [{id, filename, content_type, size, storage_path}]
  created_at timestamptz not null default now()
);
create index if not exists idx_inbound_emails_status on inbound_emails(status);
