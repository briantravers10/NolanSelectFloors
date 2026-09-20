-- A material/invoice line no longer has to belong to a job. Supplier-only
-- invoices (stock, tools, anything not for one job) are the same record
-- with project_id null: they count under the supplier and in company
-- materials spend, but in no job's cost. Linking later just sets project_id.
alter table project_materials alter column project_id drop not null;
create index if not exists idx_project_materials_supplier on project_materials(supplier);
