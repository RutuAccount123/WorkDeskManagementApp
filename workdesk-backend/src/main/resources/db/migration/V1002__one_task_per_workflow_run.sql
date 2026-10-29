alter table workflow_run
  add column step_progress jsonb not null default '[]';
