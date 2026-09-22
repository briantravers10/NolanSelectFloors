-- COI filed from email: the certificate file lives on the job so the
-- schedule's COI badge can link straight to it.
alter table projects add column if not exists coi_file_reference text;
alter table projects add column if not exists coi_file_name text;
alter table projects add column if not exists coi_received_at timestamptz;
-- Who in the office is sending the invoice for a completed job.
alter table projects add column if not exists invoice_assigned_to uuid references office_users(id) on delete set null;
