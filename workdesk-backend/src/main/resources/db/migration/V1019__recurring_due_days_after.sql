-- Weekly / monthly / yearly tasks: instead of a duration in minutes, the task is due on a later day at a set time.
-- due_days_after = how many days after the start day the copy is due (0 = same day). Daily tasks keep using minutes.
alter table recurring_template add column due_days_after integer not null default 0
  check (due_days_after between 0 and 364);
alter table recurring_template drop constraint recurring_template_schedule_pair_check;
