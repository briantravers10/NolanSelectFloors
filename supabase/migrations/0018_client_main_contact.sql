-- The management company's main point of contact, stored as a normal
-- contacts row (so it shows in Contacts/search) and pointed at from the
-- client. Idempotent.
alter table client_companies add column if not exists main_contact_id uuid references contacts(id) on delete set null;
