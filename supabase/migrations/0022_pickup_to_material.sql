-- Every schedule "item to collect" also gets a line in the job's Materials
-- so a price can be put on it later; this links the two. Idempotent.
alter table project_materials add column if not exists pickup_item_id uuid references schedule_pickup_items(id) on delete set null;
create index if not exists idx_project_materials_pickup on project_materials(pickup_item_id);
