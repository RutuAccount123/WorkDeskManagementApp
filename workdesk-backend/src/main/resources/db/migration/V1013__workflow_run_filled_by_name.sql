-- Who filled an FMS entry through the shareable form link when they are not a Work Desk member
-- (they type their name on the form). Members who are signed in are saved in form_filled_by as before.
alter table workflow_run add column form_filled_by_name varchar(120);
