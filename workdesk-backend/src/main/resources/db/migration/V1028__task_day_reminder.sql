-- Day reminders: on the day before the due date and on the due day (once each day).
-- High / urgent work is reminded on both days whatever its status; other work only while still in To do.
alter table task add column day_reminded_on date;
