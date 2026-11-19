-- A ticket can also be about a leave instead of a task: an employee asks an admin to change or remove their leave.
-- subject keeps a short text of what it is about ("Leave 20 Nov 2026 – 22 Nov 2026"), even if the leave is later removed.
alter table task_ticket alter column task_id drop not null;
alter table task_ticket add column leave_id bigint references employee_leave(id) on delete set null;
alter table task_ticket add column subject varchar(200) not null default '';
create index task_ticket_leave on task_ticket (leave_id) where leave_id is not null;
