-- Optional price on a schedule "Items to Order / Collect" entry, so the
-- office can put a cost against quick pickups from the project page and
-- have it count toward the job's materials cost. Idempotent.
alter table schedule_pickup_items add column if not exists cost numeric(10,2);
