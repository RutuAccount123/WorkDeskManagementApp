-- Proof of work: files or photos the assignee attaches when marking a task done or submitting it for review.
-- The reviewer / assigner opens them on the task page to check the work. Deleted together with the task.
create table task_attachment (
  id              bigint generated always as identity primary key,
  task_id         bigint not null references task(id) on delete cascade,
  uploaded_by_id  bigint not null references employee(id),
  file_name       varchar(200) not null check (btrim(file_name) <> ''),
  content_type    varchar(100) not null,
  size_bytes      integer not null check (size_bytes > 0),
  data            bytea not null,
  created_at      timestamptz not null default now()
);
create index task_attachment_task on task_attachment (task_id, created_at);
