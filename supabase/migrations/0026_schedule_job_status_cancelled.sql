-- "Cancelled" job status for a schedule day: the job stays in history but
-- its crew (and any logged hours) for that day are removed so nobody is
-- costed against a job that didn't happen.
alter type schedule_job_status add value if not exists 'Cancelled';
