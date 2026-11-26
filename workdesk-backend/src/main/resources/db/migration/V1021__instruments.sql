-- Instruments tab: the company's site instruments (moisture meter, laser meter, paint sprayer, ...),
-- who has each one now, where, and the full history of who used it when.
-- It stands on its own: it only uses the employee list, nothing from tasks. Everyone signed in can see and use it.

create table instrument (
  id             bigint generated always as identity primary key,
  name           varchar(120) not null check (btrim(name) <> ''),
  weight_kg      numeric(8, 2) check (weight_kg is null or weight_kg > 0),
  info           varchar(1000) not null default '',
  created_by_id  bigint not null references employee(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One row per time a person had the instrument. The row with no ended_at is who has it now;
-- no such row = it is free in the office store.
create table instrument_use (
  id             bigint generated always as identity primary key,
  instrument_id  bigint not null references instrument(id) on delete cascade,
  holder_id      bigint not null references employee(id),
  location       varchar(160) not null default '',
  project        varchar(160) not null default '',
  given_by_id    bigint not null references employee(id),
  started_at     timestamptz not null,
  note           varchar(500) not null default '',
  ended_at       timestamptz,
  ended_by_id    bigint references employee(id),
  end_action     varchar(10) check (end_action in ('SUBMITTED', 'SHIFTED')),
  end_note       varchar(500) not null default '',
  check ((ended_at is null) = (end_action is null))
);
create index instrument_use_instrument on instrument_use (instrument_id, started_at);
-- at most one person has an instrument at a time
create unique index instrument_use_current on instrument_use (instrument_id) where ended_at is null;
