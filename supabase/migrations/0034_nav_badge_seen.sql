-- Sidebar "needs attention" badges (lib/nav-badges.ts) should clear once a
-- user opens that section, and only reappear when something genuinely NEW
-- shows up afterward — not sit there forever just because the underlying
-- issue is still unresolved. One row per (user, section) remembers when
-- that user last looked; badge counts and per-item "New" highlights are
-- both computed against it.
create table if not exists nav_badge_seen (
  company_id uuid not null references companies(id) on delete cascade,
  -- office_users.id, or the OWNER_ACTING_ID sentinel "owner" (same
  -- plain-text convention as agenda_events.owner_user_id — no users table).
  user_key text not null,
  -- NAV_ITEMS href this row tracks, e.g. "/inbox", "/job-requests".
  section text not null,
  last_seen_at timestamptz not null default now(),
  primary key (company_id, user_key, section)
);

alter table nav_badge_seen enable row level security;
