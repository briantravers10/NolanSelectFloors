-- Manual ordering of jobs within a colour group on the schedule (drag to
-- rearrange on Create/Edit). Colour priority still wins; this only orders
-- within Yellow / Blue / Gray / Pink. Null = default order. Idempotent.
alter table project_schedule_days add column if not exists sort_order integer;
