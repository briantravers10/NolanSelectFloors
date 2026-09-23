-- Distinguishes a change order we sent the customer from an actual outbound
-- invoice, while reusing the same table/storage/signed-url plumbing. Only
-- 'invoice' rows ever participate in the "current invoice" (is_current)
-- concept and the schedule's Invoice quick link — a change order never
-- becomes "the current invoice" and never demotes one.
alter table project_outbound_invoices add column if not exists document_type text not null default 'invoice';
alter table project_outbound_invoices add constraint project_outbound_invoices_document_type_check check (document_type in ('invoice', 'change_order'));
