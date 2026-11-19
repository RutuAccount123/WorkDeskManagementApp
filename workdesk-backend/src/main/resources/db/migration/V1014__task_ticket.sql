-- Tickets: when someone needs help with a task, they raise a ticket on it and assign it to another
-- person with a note. That person can open the task, replies, and marks the ticket resolved.
create table task_ticket (
  id              bigint generated always as identity primary key,
  task_id         bigint not null references task(id) on delete cascade,
  raised_by_id    bigint not null references employee(id),
  assigned_to_id  bigint not null references employee(id),
  note            text not null check (btrim(note) <> ''),
  status          varchar(10) not null default 'OPEN' check (status in ('OPEN', 'RESOLVED')),
  reply           text,
  resolved_by_id  bigint references employee(id),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  check (assigned_to_id <> raised_by_id)
);
create index task_ticket_task on task_ticket (task_id, created_at);
create index task_ticket_assigned on task_ticket (assigned_to_id, status);
create index task_ticket_raised on task_ticket (raised_by_id, status);
