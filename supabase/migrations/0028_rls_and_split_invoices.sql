-- Lock the database down. The app talks to Postgres only through the
-- server with the service role key (which bypasses RLS), so enabling RLS
-- with no policies means the public anon key can no longer read or write
-- any table directly. The one anon-key read the app makes (the middleware
-- bootstrap check) goes through a SECURITY DEFINER function instead.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- "Does at least one staff login exist?" for the middleware, without
-- exposing office_users to the anon key. Returns only a boolean.
create or replace function public.has_any_real_account()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from office_users where auth_user_id is not null);
$$;
revoke all on function public.has_any_real_account() from public;
grant execute on function public.has_any_real_account() to anon, authenticated;

-- Split invoices: a part remembers the line it was split from.
alter table project_materials add column if not exists split_from_id uuid;
