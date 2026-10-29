alter table task
  add column estimated_hours numeric(7, 4)
    check (estimated_hours is null or estimated_hours between 0.25 and 24);

alter table recurring_template
  add column estimated_hours numeric(7, 4)
    check (estimated_hours is null or estimated_hours between 0.25 and 24);
