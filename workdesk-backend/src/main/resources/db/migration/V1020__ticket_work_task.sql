-- The person a ticket is raised to gets it as a task of their own ("Ticket: …"), so the work is in their
-- task list, calendar and performance. from_ticket_id links that task to its ticket; the task stays in the
-- record even if the ticket goes (the ticket is removed with the task it was raised on).
alter table task add column from_ticket_id bigint references task_ticket(id) on delete set null;
create index task_from_ticket on task (from_ticket_id) where from_ticket_id is not null;
