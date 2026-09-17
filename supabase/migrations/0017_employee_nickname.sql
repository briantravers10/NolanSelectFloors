-- Nickname shown in brackets after the full name on the schedule and
-- searchable in the crew picker. Idempotent.
alter table employees add column if not exists nickname text;
