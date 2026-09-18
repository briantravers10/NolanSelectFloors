-- "Invoice Sent" tick on completed jobs: shown as a reminder on everyone's
-- dashboard until one person marks it. Idempotent.
alter table projects add column if not exists invoice_sent_at timestamptz;
alter table projects add column if not exists invoice_sent_by text;
