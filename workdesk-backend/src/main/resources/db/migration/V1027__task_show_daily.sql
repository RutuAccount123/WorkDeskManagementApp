-- A task can show in To do every day from the day it is made until it is due
-- (not only on its due day), so it is not forgotten.
alter table task add column show_daily boolean not null default false;
