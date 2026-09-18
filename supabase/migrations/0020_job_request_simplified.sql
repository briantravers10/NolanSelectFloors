-- Job requests simplified to New Request → In Progress (someone started
-- it) → Job Created (converted), plus Archived. Older statuses stay valid
-- for existing rows but are no longer offered in the UI. Idempotent.
alter type job_request_status add value if not exists 'In Progress';
alter type job_request_status add value if not exists 'Archived';
alter table job_requests add column if not exists started_by_user_id text;
alter table job_requests add column if not exists started_by_name text;
alter table job_requests add column if not exists started_at timestamptz;
