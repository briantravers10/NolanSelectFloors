-- Consolidate every row onto one fixed, well-known company UUID so the app's
-- synchronous getCurrentCompanyId() (lib/current-user.ts, backed by
-- lib/seed-data.ts COMPANY_ID) can stamp new records with a constant that
-- actually exists in the real database. The first seed run had assigned the
-- company a random UUID, so every runtime insert failed on company_id with
-- "invalid input syntax for type uuid". Idempotent: safe to re-run.
--
-- Also cleans up any stray duplicate companies rows (a second seed run
-- inserted one before failing on users.email uniqueness), and adds the two
-- related_record_type values the audit log already writes for staff-access
-- changes — without them those activity_log inserts were silently dropped.

alter type related_record_type add value if not exists 'office_user';
alter type related_record_type add value if not exists 'section_permission';

do $$
declare
  canonical uuid := '11111111-1111-4111-8111-111111111111';
  source_id uuid;
  r record;
begin
  if not exists (select 1 from companies where id = canonical) then
    select id into source_id from companies where id <> canonical order by created_at, id limit 1;
    if source_id is not null then
      insert into companies (id, name, phone, email, address, logo_url, created_at)
      select canonical, name, phone, email, address, logo_url, created_at from companies where id = source_id;
    else
      insert into companies (id, name) values (canonical, 'Nolan Select Floors');
    end if;
  end if;

  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'company_id' and table_name <> 'companies'
  loop
    execute format('update %I set company_id = $1 where company_id <> $1', r.table_name) using canonical;
  end loop;

  delete from companies where id <> canonical;
end $$;
