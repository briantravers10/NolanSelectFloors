-- One shared, owner-managed code staff must enter (alongside their email)
-- to set their own password on first login (/login → "Set up my password").
-- Lets accounts be self-served without any invite email, while a stranger
-- who merely knows a staff email can't claim it. Managed from Company Setup
-- → Staff Access (Owner/Admin only). Idempotent.
alter table companies add column if not exists staff_setup_code text;
