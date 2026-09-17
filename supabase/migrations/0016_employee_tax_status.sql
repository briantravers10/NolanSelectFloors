-- Tax classification per employee: 'W-4' (payroll employee) or '1099'
-- (independent contractor). Nullable = not set yet. Idempotent.
alter table employees add column if not exists tax_status text
  check (tax_status is null or tax_status in ('W-4', '1099'));
