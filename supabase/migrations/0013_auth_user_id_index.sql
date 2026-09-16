-- Nolan Select Floors — auth_user_id lookup index (build 12, Activating
-- Real Login)
--
-- 0012_permissions_and_auth.sql already added office_users.auth_user_id
-- (text) and office_users.is_owner — that part of the schema is sufficient
-- for real Supabase Auth as-is (see README "Activating Real Login"). The
-- one genuine gap: lib/auth.ts#getCurrentSession() now does a lookup by
-- auth_user_id on every authenticated request (via
-- lib/db.ts#getOfficeUserByAuthId()), and that column had no index — every
-- request would otherwise force a sequential scan of office_users.
--
-- Also adds a uniqueness constraint: two office_users rows should never
-- point at the same Supabase Auth user id. Partial (where auth_user_id is
-- not null) so the many demo-mode rows that are still null (no real
-- account created yet) are unaffected — same pattern as the existing
-- idx_office_users_email partial unique index from 0012.
create unique index if not exists idx_office_users_auth_user_id
  on office_users(auth_user_id)
  where auth_user_id is not null;
