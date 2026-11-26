-- Instruments tab: send an instrument for repair (and get it back), and remove one that is no longer used.

-- Removed instruments leave the list but keep their history; who removed it, when and why.
alter table instrument
  add column removed_at      timestamptz,
  add column removed_by_id   bigint references employee(id),
  add column removed_reason  varchar(500) not null default '';

-- A person's use can now also end because the instrument went for repair or was removed.
alter table instrument_use drop constraint if exists instrument_use_end_action_check;
alter table instrument_use add constraint instrument_use_end_action_check
  check (end_action in ('SUBMITTED', 'SHIFTED', 'REPAIR', 'REMOVED'));

-- One row per time the instrument went for repair. The row with no returned_at = it is under repair now.
create table instrument_repair (
  id               bigint generated always as identity primary key,
  instrument_id    bigint not null references instrument(id) on delete cascade,
  problem          varchar(500) not null check (btrim(problem) <> ''),
  repair_shop      varchar(160) not null check (btrim(repair_shop) <> ''),
  expected_back    date,
  estimated_cost   numeric(12, 2) check (estimated_cost is null or estimated_cost >= 0),
  note             varchar(500) not null default '',
  sent_by_id       bigint not null references employee(id),
  sent_at          timestamptz not null,
  returned_at      timestamptz,
  returned_by_id   bigint references employee(id),
  repair_cost      numeric(12, 2) check (repair_cost is null or repair_cost >= 0),
  return_note      varchar(500) not null default ''
);
create index instrument_repair_instrument on instrument_repair (instrument_id, sent_at);
-- at most one open repair per instrument
create unique index instrument_repair_current on instrument_repair (instrument_id) where returned_at is null;
