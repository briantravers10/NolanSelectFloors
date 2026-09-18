-- Agenda items can be marked done and record who added them (office
-- staff can fill Aidan's agenda); crew requirements can name the staff
-- being estimated and the number of days; materials get a unit price and
-- an optional invoice attachment. Idempotent.
alter table agenda_events add column if not exists completed_at timestamptz;
alter table agenda_events add column if not exists created_by_name text;
alter table project_crew_requirements add column if not exists employee_ids uuid[] not null default '{}';
alter table project_crew_requirements add column if not exists estimated_days numeric(6,2);
alter table project_materials add column if not exists unit_price numeric(12,2);
alter table project_materials add column if not exists invoice_path text;
alter table project_materials add column if not exists invoice_name text;
