-- =====================================================================
--  The business rules moved from PL/pgSQL into the Java service layer.
--  1. Remove the old database functions (only exists on databases that ran the earlier version).
--  2. Two safety indexes so background jobs can never create the same thing twice,
--     even if two servers run them at the same moment.
-- =====================================================================
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = current_schema()
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')   -- never touch extension functions
      and (p.proname like 'api\_%' or p.proname like 'wd\_%' or p.proname like 'task\_%' or p.proname like 'wf\_%'
           or p.proname like 'run\_%' or p.proname like 'template\_%' or p.proname like 'recurring\_%'
           or p.proname like 'holiday\_%' or p.proname like 'auth\_%' or p.proname like 'emp\_%'
           or p.proname in ('activity_json', 'workflow_json', 'notification_json', 'employee_check'))
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- one copy of a daily / weekly task per day
create unique index if not exists task_recurring_copy_uq
  on task (recurring_template_id, due_at) where recurring_template_id is not null;

-- one scheduled run of an FMS per day (manual "Start new" runs can be many)
create unique index if not exists workflow_run_scheduled_uq
  on workflow_run (workflow_id, run_date) where not manual and workflow_id is not null;

-- the office time zone now comes from application.yml (wd.timezone)
drop table if exists app_setting;
