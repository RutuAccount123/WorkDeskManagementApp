-- How a ticket was closed: task_done = the person it was raised to finished the task themselves
-- (the task moved to them and is done); false = they answered and the task went back to its assignee.
alter table task_ticket add column task_done boolean not null default false;
