alter table recurring_template
  drop constraint recurring_template_frequency_check;

alter table recurring_template
  drop constraint recurring_template_check;

alter table recurring_template
  add constraint recurring_template_frequency_check
    check (frequency in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  add constraint recurring_template_weekday_check
    check ((frequency = 'WEEKLY' and day_of_week is not null)
        or (frequency <> 'WEEKLY' and day_of_week is null)),
  add column start_date date,
  add column scheduled_time time,
  add column duration_minutes integer
    check (duration_minutes is null or duration_minutes between 1 and 1439),
  add constraint recurring_template_schedule_pair_check
    check ((scheduled_time is null and duration_minutes is null)
        or (scheduled_time is not null and duration_minutes is not null));

alter table task
  add column scheduled_at timestamptz;

create index task_template_scheduled on task (recurring_template_id, scheduled_at)
  where recurring_template_id is not null and scheduled_at is not null;
