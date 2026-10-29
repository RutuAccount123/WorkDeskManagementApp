-- =====================================================================
--  Work Desk: tables.  PostgreSQL 14+.
--  Business rules live in PL/pgSQL functions (R__*.sql files).
-- =====================================================================
-- No extensions needed (works on managed PostgreSQL too). The first admin is created by the app on first start.

create table app_setting (
  key   text primary key,
  value text not null
);
insert into app_setting (key, value) values ('timezone', 'Asia/Kolkata');

create table employee (
  id             bigint generated always as identity primary key,
  employee_code  varchar(40),
  full_name      varchar(120) not null check (btrim(full_name) <> ''),
  email          varchar(160) not null check (email = lower(btrim(email)) and email like '%_@_%'),
  password_hash  varchar(100) not null,
  role           varchar(10)  not null check (role in ('ADMIN', 'EMPLOYEE')),
  department     varchar(80),
  designation    varchar(80),
  phone          varchar(30),
  active         boolean      not null default true,
  token_version  integer      not null default 0,   -- raised on password change / deactivation: old logins stop working
  created_at     timestamptz  not null default now()
);
create unique index employee_email_uq on employee (email);

create table holiday (
  id            bigint generated always as identity primary key,
  holiday_date  date not null unique,
  name          varchar(120) not null check (btrim(name) <> ''),
  note          varchar(300) not null default '',
  created_at    timestamptz not null default now()
);

create table recurring_template (
  id                 bigint generated always as identity primary key,
  title              varchar(200) not null check (btrim(title) <> ''),
  description        text not null default '',
  assignee_id        bigint not null references employee(id),
  created_by_id      bigint not null references employee(id),
  priority           varchar(10) not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  frequency          varchar(10) not null check (frequency in ('DAILY','WEEKLY')),
  day_of_week        varchar(10) check (day_of_week in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY')),
  due_time           time not null default '18:00',
  active             boolean not null default true,
  last_generated_on  date,
  workflow_id        bigint,
  created_at         timestamptz not null default now(),
  check (frequency = 'DAILY' or day_of_week is not null)
);

create table workflow (
  id              bigint generated always as identity primary key,
  name            varchar(160) not null check (btrim(name) <> ''),
  description     text not null default '',
  frequency       varchar(10) not null check (frequency in ('DAILY','WEEKLY','ON_DEMAND')),
  day_of_week     varchar(10) check (day_of_week in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY')),
  start_time      time not null,
  end_time        time not null check (end_time > start_time),
  active          boolean not null default true,
  last_run_on     date,
  created_by_id   bigint not null references employee(id),
  source_task_id  bigint,
  -- [{id,label,type,required,options[]}]
  form_fields     jsonb not null default '[]',
  -- [{title,assigneeId,hours,priority,how,checklist[]}]
  steps           jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) >= 2),
  created_at      timestamptz not null default now()
);
alter table recurring_template add foreign key (workflow_id) references workflow(id) on delete set null;

create table workflow_run (
  id               bigint generated always as identity primary key,
  workflow_id      bigint references workflow(id) on delete set null,
  name             varchar(160) not null,
  run_date         date not null,
  created_by_id    bigint not null references employee(id),
  start_time       time not null,
  end_time         time not null,
  steps            jsonb not null,          -- copy of the workflow's steps when the run started
  form_fields      jsonb not null default '[]',
  form_data        jsonb,
  form_filled_by   bigint references employee(id),
  form_filled_at   timestamptz,
  number           integer not null default 1,
  manual           boolean not null default false,
  source_task_id   bigint,
  current_step     integer not null default 0,
  status           varchar(10) not null default 'RUNNING' check (status in ('RUNNING','DONE','STOPPED')),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index workflow_run_wf_date on workflow_run (workflow_id, run_date);

create table task (
  id                     bigint generated always as identity primary key,
  title                  varchar(200) not null check (btrim(title) <> ''),
  description            text not null default '',
  assignee_id            bigint not null references employee(id),
  created_by_id          bigint not null references employee(id),
  reviewer_id            bigint references employee(id),   -- null = no review needed
  priority               varchar(10) not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  status                 varchar(12) not null default 'TODO'
                         check (status in ('TODO','IN_PROGRESS','SUBMITTED','COMPLETED','REOPENED','CANCELLED')),
  due_at                 timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  started_at             timestamptz,
  submitted_at           timestamptz,
  completed_at           timestamptz,
  recurring_template_id  bigint references recurring_template(id) on delete set null,
  workflow_id            bigint references workflow(id) on delete set null,   -- FMS linked to this task
  workflow_run_id        bigint references workflow_run(id) on delete set null,
  workflow_step          integer,
  checklist              jsonb not null default '[]',      -- [{text,done,doneAt}]
  due_soon_reminded      boolean not null default false,
  overdue_reminded       boolean not null default false,
  check (reviewer_id is null or reviewer_id <> assignee_id)
);
create index task_assignee on task (assignee_id, status);
create index task_created_by on task (created_by_id);
create index task_reviewer on task (reviewer_id) where reviewer_id is not null;
create index task_due on task (due_at);
create index task_template on task (recurring_template_id) where recurring_template_id is not null;
create index task_run on task (workflow_run_id) where workflow_run_id is not null;

alter table workflow add foreign key (source_task_id) references task(id) on delete set null;
alter table workflow_run add foreign key (source_task_id) references task(id) on delete set null;

create table task_activity (
  id           bigint generated always as identity primary key,
  task_id      bigint not null references task(id) on delete cascade,
  actor_id     bigint references employee(id),   -- null = system
  action       varchar(20) not null,
  from_status  varchar(12),
  to_status    varchar(12),
  comment      text,
  created_at   timestamptz not null default clock_timestamp()
);
create index task_activity_task on task_activity (task_id, created_at);

create table notification (
  id            bigint generated always as identity primary key,
  recipient_id  bigint not null references employee(id),
  task_id       bigint references task(id) on delete cascade,
  type          varchar(20) not null,
  message       text not null,
  read          boolean not null default false,
  created_at    timestamptz not null default clock_timestamp()
);
create index notification_recipient on notification (recipient_id, created_at desc);

create table digest_log (
  employee_id  bigint not null references employee(id),
  day          date   not null,
  primary key (employee_id, day)
);
