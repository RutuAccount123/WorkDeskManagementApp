# Changes from the test review (27 Oct 2026)

Tests added: 98 (unit + integration), all passing. Run `npm install` once, then `npm test`.

## Bugs fixed
1. **FMS sheet showed raw computer dates** like `2026-10-27T06:30:00.000Z` in Timestamp, Planned, Actual and checklist times, and in the Excel export. Now `27 Oct, 12:00 pm` everywhere. Date answers show as `27 Oct 2026`.
2. **FMS sheet: step 1 could not fill the entry form** for a scheduled run. The form never appeared and "Start work" failed with "Fill the workflow form first". The form now shows on the sheet and starts the work.
3. **FMS sheet: stopped runs were never greyed out** (it checked a status that does not exist).
4. **Assign a task: wrong reviewer after changing the person.** Choosing "Me", then someone else, kept "No review needed" hidden in the form, so the hint was wrong. Now you become the reviewer, as the hint says.
5. **Employee profile "‹ All employees" went to the Dashboard.** Now goes to Employees.
6. **New FMS button was missing** on the Workflows page (the README described it).
7. **Top bar said "FMS sheet" on the Edit FMS page**, and "Tasks" on the employee's "My tasks" page.
8. **Saving an employee or task with an empty name/title was accepted.** Now a clear error.
9. **Weekly tasks could be set for Sunday** by the admin, against the weekly-off rule. "Create today's task" also ignored Sundays and holidays.
10. Small: monthly performance kept an old error after recovering; "Mark all read" could fail silently; the daily/weekly form could be submitted twice; an FMS linked to a finished task lost the link in the edit screen.

## Same format everywhere (admin and employee)
- **One set of status words**: To do · In progress · Waiting for review · Done · Sent back · Cancelled. Before, the status steps, history, login page and team cards said "Working" and "Submitted" while the chips said "In progress" and "Waiting for review".
- **Menu label = top bar title = page heading** on every page: Employees (was "People"), Daily & weekly tasks (was "Recurring tasks"), Holidays (was "Office holidays"), My account (was "Your account"). FMS sheet page now has a normal heading row with Edit / Start new.
- Buttons named the same way: Add employee, Add daily / weekly task, New FMS, Assign a task.
- Workflow frequency text is the same on every FMS screen and in the export ("Only when started").

## Clean-up
- Removed `WorkflowDetailPage.jsx` (not used by any route). Its helpers moved to `features/workflows/workflowFormat.js`.
- Removed a duplicate, never-shown form block in the task page.
