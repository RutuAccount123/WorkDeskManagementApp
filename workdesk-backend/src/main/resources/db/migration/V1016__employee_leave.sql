-- Personal leave of an employee (start_date..end_date, both included).
-- starts_at / ends_at are the same days as exact times in the office time zone, so a task's due time can be
-- compared directly: due_at >= starts_at and due_at < ends_at means the task falls on a leave day.
create table employee_leave (
  id             bigint generated always as identity primary key,
  employee_id    bigint not null references employee(id),
  start_date     date not null,
  end_date       date not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  reason         varchar(300) not null default '',
  created_by_id  bigint not null references employee(id),
  created_at     timestamptz not null default now(),
  check (end_date >= start_date),
  check (ends_at > starts_at)
);
create index employee_leave_employee on employee_leave (employee_id, start_date);
