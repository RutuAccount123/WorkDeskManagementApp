// Full app in a browser-like page: sign in, move around, check every screen uses the same format.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/app/App.jsx';
import { ADMIN_NAV, EMPLOYEE_NAV } from '@/config/navigation.js';
import { tokenStore } from '@/services/http.js';
import { authService, employeeService, leaveService, recurringService, taskService, ticketService } from '@/services/index.js';

const idOf = async (title) => (await taskService.list({ q: title, scope: 'all' })).find((t) => t.title === title).id;

function start(path = '/') {
  window.history.pushState({}, '', path);
  return render(<App />);
}
async function loginAs(label) {
  const user = userEvent.setup();
  start('/');
  await user.click(await screen.findByRole('button', { name: new RegExp(label) }));
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}
const topTitle = () => document.querySelector('.crumbs strong')?.textContent;
const pageTitle = async () => (await screen.findByRole('heading', { level: 1 })).textContent;

describe('sign in', () => {
  it('shows a readable error for a wrong password', async () => {
    const user = userEvent.setup();
    start('/');
    await user.type(screen.getByLabelText('Work email'), 'admin@company.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
  it('login screen uses the same status words as the rest of the app', () => {
    start('/');
    const steps = screen.getByRole('list', { name: 'How work moves' });
    expect(within(steps).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['To do', 'In progress', 'Waiting for review', 'Done']);
  });
});

describe.each([
  ['Admin', ADMIN_NAV, 'Dashboard'],
  ['Employee: Rahul', EMPLOYEE_NAV, 'My work'],
])('%s: every menu page has the same layout', (who, nav, home) => {
  it('home page, then each menu item: menu label = top bar title = page heading', async () => {
    const user = await loginAs(who);
    await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/ });
    expect(topTitle()).toBe(home);

    const sidebar = document.querySelector('.sidebar');
    for (const item of nav.flatMap((g) => g.items).filter((i) => i.to !== '/')) {
      await user.click(within(sidebar).getByRole('link', { name: item.label }));
      await waitFor(() => expect(window.location.pathname).toBe(item.to));
      if (item.to === '/my-dashboard') {
        expect(await pageTitle()).toMatch(/Good (morning|afternoon|evening), \w+/);
      } else {
        expect(await pageTitle()).toBe(item.label);
      }
      expect(topTitle()).toBe(item.label);
      // every page: one heading row, and the main action (if any) sits in it
      expect(document.querySelectorAll('.page > .page-head')).toHaveLength(1);
    }
    // account page too
    await user.click(within(sidebar).getByRole('link', { name: /Rahul|System Admin/ }));
    expect(await pageTitle()).toBe('My account');
    expect(topTitle()).toBe('My account');
  });
});

describe('today view carries over unfinished work', () => {
  it('shows earlier unfinished tasks today: not started in To do, started in In progress', async () => {
    tokenStore.set('mock-3');   // Rahul
    const dueDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d.toISOString().slice(0, 16); };
    const notStarted = await taskService.create({ title: 'Carry over not started', dueAt: dueDaysAgo(1) });
    const started = await taskService.create({ title: 'Carry over started', dueAt: dueDaysAgo(2), status: 'IN_PROGRESS' });
    await taskService.create({ title: 'Old work already done', dueAt: dueDaysAgo(1), status: 'COMPLETED' }); // finished now
    expect(notStarted.status).toBe('TODO');
    expect(started.status).toBe('IN_PROGRESS');

    start('/');
    const todo = (await screen.findByRole('heading', { level: 4, name: /^To do/ })).closest('section');
    const progress = screen.getByRole('heading', { level: 4, name: /^In progress/ }).closest('section');
    expect(await within(todo).findByText('Carry over not started')).toBeInTheDocument();
    expect(within(progress).getByText('Carry over started')).toBeInTheDocument();
    // it was due yesterday but finished today, so it belongs to today's Done
    const doneCol = screen.getByRole('heading', { level: 4, name: /^Done/ }).closest('section');
    expect(within(doneCol).getByText('Old work already done')).toBeInTheDocument();
  });

  it('week view: tasks show only on their due date, in To do / In progress groups (no carry over)', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul
    const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const later = new Date(); later.setHours(23, 30, 0, 0);
    const old = new Date(); old.setDate(old.getDate() - 9); old.setHours(10, 0, 0, 0);   // an earlier week
    await taskService.create({ title: 'Week due today to do', dueAt: local(later) });
    await taskService.create({ title: 'Week due today started', dueAt: local(later), status: 'IN_PROGRESS' });
    await taskService.create({ title: 'Week old unfinished', dueAt: local(old) });

    start('/');
    await user.click(await screen.findByRole('tab', { name: 'Week' }));
    const today = await waitFor(() => {
      const col = document.querySelector('.week-day.is-today');
      expect(col).not.toBeNull();
      return col;
    });
    const todoGroup = await waitFor(() => {
      const g = today.querySelector('.wg-todo');
      expect(g).not.toBeNull();
      return g;
    });
    expect(within(todoGroup).getByText('Week due today to do')).toBeInTheDocument();
    expect(within(today.querySelector('.wg-progress')).getByText('Week due today started')).toBeInTheDocument();
    expect(within(today).queryByText('Week old unfinished')).toBeNull();
  });

  it('week view: a repeating task weeks ahead shows on its day and opens when clicked', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');   // admin sets it up for Rahul
    await recurringService.create({ title: 'Far weekly check', assigneeId: 3, frequency: 'WEEKLY', dayOfWeek: 'TUESDAY', dueTime: '17:00' });
    tokenStore.set('mock-3');   // Rahul

    start('/');
    await user.click(await screen.findByRole('tab', { name: 'Week' }));
    for (let i = 0; i < 3; i += 1) await user.click(screen.getByRole('button', { name: 'Next' }));
    const grid = await waitFor(() => { const g = document.querySelector('.week-grid'); expect(g).not.toBeNull(); return g; });
    const item = (await within(grid).findByText('Far weekly check')).closest('button');
    expect(item).toHaveClass('wi-upcoming');
    expect(item.closest('.week-day').querySelector('.week-head strong').textContent).toBe('Tue');
    await user.click(item);
    expect(await screen.findByRole('heading', { level: 1, name: 'Far weekly check' })).toBeInTheDocument();
  });

  it('"show every day until due": a task due in 2 days is in today\'s To do, after today\'s work; 5 per page', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');   // admin assigns Rahul work due in two days, shown every day
    const day = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    await taskService.create({ title: 'Measure Wakad site', assigneeId: 3, dueAt: day(2, 18), showDaily: true });
    await taskService.create({ title: 'Not shown before its day', assigneeId: 3, dueAt: day(2, 18) });
    for (let i = 1; i <= 6; i += 1) await taskService.create({ title: `Today job ${i}`, assigneeId: 3, dueAt: day(0, 23) });
    tokenStore.set('mock-3');   // Rahul

    start('/');
    const todo = await waitFor(() => { const c = document.querySelector('.dc-todo'); expect(c).not.toBeNull(); return c; });
    await within(todo).findByText('Today job 1');
    expect(within(todo).getAllByRole('button').filter((b) => b.classList.contains('day-card')).length).toBeLessThanOrEqual(5);
    const pager = within(todo).getByRole('navigation', { name: 'To do pages' });
    // keep going to the last page: the task due in 2 days comes after today's work
    let next = within(pager).getByRole('button', { name: /next/i });
    while (!next.disabled) { await user.click(next); next = within(pager).getByRole('button', { name: /next/i }); }
    const card = (await within(todo).findByText('Measure Wakad site')).closest('button');
    expect(card).toHaveTextContent('every day until due');
    expect(within(todo).queryByText('Today job 1')).toBeNull();
    expect(screen.queryByText('Not shown before its day')).toBeNull();
  });

  it('In progress and Done on the Day view also show 5 per page, with ‹ › arrows', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul's own work, started and done today
    for (let i = 1; i <= 7; i += 1) {
      await taskService.create({ title: `Started job ${i}`, status: 'IN_PROGRESS' });
      await taskService.create({ title: `Finished job ${i}`, status: 'COMPLETED' });
    }
    start('/');
    for (const [col, name, word] of [['.dc-progress', 'In progress pages', 'Started job'], ['.dc-done', 'Done pages', 'Finished job']]) {
      const c = await waitFor(() => { const el = document.querySelector(col); expect(within(el).getAllByText(new RegExp(word)).length).toBeGreaterThan(0); return el; });
      const cards = () => [...c.querySelectorAll('.day-card')];
      expect(cards().length).toBe(5);
      const pager = within(c).getByRole('navigation', { name });
      const first = cards().map((b) => b.textContent);
      await user.click(within(pager).getByRole('button', { name: 'Next page' }));
      expect(cards().length).toBeGreaterThan(0);
      expect(cards().map((b) => b.textContent)).not.toEqual(first);
    }
  });

  it('"Add my work" can also show the work every day in To do until its date', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul
    start('/');
    await user.click(await screen.findByRole('button', { name: 'Add my work' }));
    await user.type(screen.getByLabelText('What is the work?'), 'Prepare Hinjewadi quotation');
    const later = new Date(); later.setDate(later.getDate() + 2);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}` } });
    await user.click(screen.getByLabelText('Show in To do every day until the date'));
    await user.click(screen.getByRole('button', { name: 'Add work' }));

    const todo = await waitFor(() => { const c = document.querySelector('.dc-todo'); expect(c).not.toBeNull(); return c; });
    const pager = within(todo).queryByRole('navigation', { name: 'To do pages' });
    if (pager) {
      let next = within(pager).getByRole('button', { name: /next/i });
      while (!next.disabled) { await user.click(next); next = within(pager).getByRole('button', { name: /next/i }); }
    }
    const card = (await within(todo).findByText('Prepare Hinjewadi quotation')).closest('button');
    expect(card).toHaveTextContent('every day until due');
  });

  it('a ticket raised to me opens on the Tickets page, ready to work on, not as a task', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-2');   // Priya raises a ticket to Rahul on her task
    const mine = await taskService.create({ title: 'Check GST on site bills', assigneeId: 2 });
    const k = await ticketService.raise(mine.id, 3, 'Please send me the two missing bills');
    tokenStore.set('mock-3');   // Rahul

    start('/');
    const day = await waitFor(() => { const d = document.querySelector('.day-cols'); expect(d).not.toBeNull(); return d; });
    await user.click((await within(day).findByText('Ticket: Check GST on site bills')).closest('button'));

    expect(await screen.findByRole('heading', { level: 1, name: 'Tickets' })).toBeInTheDocument();
    const card = await waitFor(() => { const c = document.querySelector('.ticket-focus'); expect(c).not.toBeNull(); return c; });
    expect(card).toHaveTextContent('Please send me the two missing bills');
    expect(within(card).getByLabelText('Reply')).toBeInTheDocument();   // "Work on this ticket" is already open
    expect(within(card).getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
    expect(window.location.search).toContain(`ticket=${k.id}`);
  });

  it('upcoming work started today shows today under In progress, with the time it was started', async () => {
    tokenStore.set('mock-3');   // Rahul
    const due = new Date(); due.setDate(due.getDate() + 10); due.setHours(18, 0, 0, 0);
    const local = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const t = await taskService.create({ title: 'Upcoming started early', dueAt: local(due) });
    const started = await taskService.changeStatus(t.id, 'IN_PROGRESS');
    expect(started.startedAt).toBeTruthy();

    start('/');
    const progressCol = (await screen.findByRole('heading', { level: 4, name: /^In progress/ })).closest('section');
    const card = (await within(progressCol).findByText('Upcoming started early')).closest('button');
    expect(within(card).getByText(/^Started /)).toBeInTheDocument();

    // it also shows on the day it was scheduled for, with its status and real start time, and opens the task
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Week' }));
    let copy = null;
    for (let i = 0; i < 3 && !copy; i += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
      copy = await waitFor(() => document.querySelector('.week-grid')).then(() =>
        [...document.querySelectorAll('.week-grid .wi-planned')].find((b) => b.textContent.includes('Upcoming started early')) || null);
    }
    expect(copy).not.toBeNull();
    expect(copy).toHaveClass('wi-progress');
    expect(copy.closest('.week-day').querySelector('.week-head span').textContent).toMatch(new RegExp(`\\s${due.getDate()}$`));
    await user.click(copy);
    expect(await screen.findByRole('heading', { level: 1, name: 'Upcoming started early' })).toBeInTheDocument();
  });

  it('overdue work finished today shows today under Done, with the time it was done', async () => {
    tokenStore.set('mock-3');   // Rahul
    const d = new Date(); d.setDate(d.getDate() - 2); d.setHours(10, 0, 0, 0);
    const late = await taskService.create({ title: 'Late work finished today', dueAt: d.toISOString().slice(0, 16), status: 'IN_PROGRESS' });
    const done = await taskService.changeStatus(late.id, 'COMPLETED');
    expect(done.status).toBe('COMPLETED');

    start('/');
    const doneCol = (await screen.findByRole('heading', { level: 4, name: /^Done/ })).closest('section');
    const card = (await within(doneCol).findByText('Late work finished today')).closest('button');
    expect(within(card).getByText(/^Done /)).toBeInTheDocument();
    expect(within(card).getByText(/^was due /)).toBeInTheDocument();
  });
});

describe('leave on My work', () => {
  it('shows the leave and lets the employee move a task that fell on it', async () => {
    const user = userEvent.setup();
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    tokenStore.set('mock-1');   // admin
    await leaveService.create({ employeeId: 3, startDate: day(-2), endDate: day(-1), reason: 'Fever' });
    tokenStore.set('mock-3');   // Rahul
    await taskService.create({ title: 'Fell on my leave', dueAt: `${day(-1)}T11:00` });

    start('/');
    const panel = (await screen.findByRole('heading', { name: 'My leave' })).closest('section');
    const item = (await within(panel).findByText('Fell on my leave')).closest('li');
    await user.click(within(item).getByRole('button', { name: 'Allow' }));
    // nothing left to decide, so the list of leave-day work goes away
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Work from your leave days/ })).toBeNull());
    const moved = (await taskService.list({ q: 'Fell on my leave' }))[0];
    expect(moved.onLeave).toBe(false);
    expect(new Date(moved.dueAt) >= new Date(new Date().setHours(0, 0, 0, 0))).toBe(true);
  });
});

describe('tasks page layout', () => {
  it('everything shows as columns; one group picked (e.g. Overdue from the dashboard) shows as rows', async () => {
    tokenStore.set('mock-1');
    const first = start('/tasks');
    await waitFor(() => expect(document.querySelector('.lanes')).not.toBeNull());
    expect(document.querySelector('.lanes.lanes-columns')).not.toBeNull();
    first.unmount();

    tokenStore.set('mock-1');
    start('/tasks?overdue=1');
    await waitFor(() => expect(document.querySelector('.lanes, .empty')).not.toBeNull());
    expect(document.querySelector('.lanes-columns')).toBeNull();
    expect(document.querySelector('.task-list-cards')).not.toBeNull();
  });
});

describe('admin dashboard stat cards', () => {
  it('links all four cards to the matching task filters', async () => {
    tokenStore.set('mock-1');
    start('/');
    await screen.findByRole('heading', { level: 1, name: /Good morning|Good afternoon|Good evening/ });

    expect(screen.getByRole('link', { name: /Overdue/ })).toHaveAttribute('href', '/tasks?overdue=1');
    expect(screen.getByRole('link', { name: /Due today/ })).toHaveAttribute('href', '/tasks?dueToday=1');
    expect(screen.getByRole('link', { name: /Waiting for review/ })).toHaveAttribute('href', '/tasks?status=SUBMITTED');
    expect(screen.getByRole('link', { name: /Done this week/ })).toHaveAttribute('href', '/tasks?status=COMPLETED&completedThisWeek=1');
  });

  it('admins can open a separate personal dashboard without changing the company dashboard', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start('/my-dashboard');

    expect(await screen.findByRole('heading', {
      level: 1,
      name: /Good (morning|afternoon|evening), \w+/,
    })).toBeInTheDocument();
    expect(screen.queryByText('Everyone’s work today')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monthly performance' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Day' })).toBeInTheDocument();

    await user.click(within(document.querySelector('.sidebar')).getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Good morning|Good afternoon|Good evening/ })).toBeInTheDocument();
    expect(await screen.findByText('Everyone’s work today')).toBeInTheDocument();
  });
});

describe('permissions in the screens', () => {
  it('department admins can assign tasks only within their accessible departments', async () => {
    tokenStore.set('mock-1');
    await employeeService.create({
      fullName: 'Accounts Department Admin', email: 'accounts.admin@company.com', password: 'Start@1234',
      role: 'ADMIN', department: 'Purchase', departmentAdmin: true, accessibleDepartments: ['Accounts', 'Projects'],
    });
    const login = await authService.login('accounts.admin@company.com', 'Start@1234');
    tokenStore.set(login.token);
    const user = userEvent.setup();
    start('/');

    await screen.findByRole('heading', { level: 1, name: /Good/ });
    const departmentFilter = await screen.findByRole('combobox', { name: 'Department' });
    expect(departmentFilter).toHaveValue('');
    expect(within(departmentFilter).getByRole('option', { name: 'All allowed departments' })).toBeInTheDocument();
    expect(within(departmentFilter).getByRole('option', { name: 'Accounts' })).toBeInTheDocument();
    expect(within(departmentFilter).getByRole('option', { name: 'Projects' })).toBeInTheDocument();
    expect(within(departmentFilter).queryByRole('option', { name: 'Purchase' })).not.toBeInTheDocument();
    expect(within(departmentFilter).queryByRole('option', { name: 'Management' })).not.toBeInTheDocument();
    const sidebar = document.querySelector('.sidebar');
    expect(within(sidebar).getByRole('link', { name: 'Employees' })).toBeInTheDocument();
    // department admins also get FMS, repeating tasks and holidays (holidays view only)
    expect(within(sidebar).getByRole('link', { name: 'Workflows (FMS)' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Repeating tasks' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Holidays' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Assign a task' }));
    const dashboardTaskDialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const dashboardAssigneeGroup = within(dashboardTaskDialog).getByRole('group', { name: 'Assign to' });
    expect(within(dashboardAssigneeGroup).getByRole('checkbox', { name: /Priya Sharma/ })).toBeInTheDocument();
    expect(within(dashboardAssigneeGroup).queryByRole('checkbox', { name: /Rahul Patil/ })).not.toBeInTheDocument();
    await user.click(within(dashboardTaskDialog).getByRole('button', { name: 'Cancel' }));

    await user.click(within(sidebar).getByRole('link', { name: 'Employees' }));
    await screen.findByRole('heading', { level: 1, name: 'Employees' });
    expect(screen.queryByRole('button', { name: 'Add employee' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Priya Sharma' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sneha Kulkarni' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rahul Patil' })).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('link', { name: 'Tasks' }));
    await screen.findByRole('heading', { level: 1, name: 'Tasks' });
    await user.click(screen.getByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const accessiblePeople = await employeeService.directory();
    const assignee = accessiblePeople.find((person) => person.role === 'EMPLOYEE');
    expect(assignee).toBeDefined();
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    expect(within(assign).getByRole('checkbox', { name: new RegExp(assignee.fullName) })).toBeInTheDocument();
    expect(within(assign).queryByRole('checkbox', { name: /Rahul Patil/ })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reviewed by')).toHaveValue('none');
    // department admins can set up repeating tasks too, like admins
    expect(within(dialog).getByLabelText('Repeat')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Title'), 'Scoped department task');
    await user.click(within(assign).getByRole('checkbox', { name: new RegExp(assignee.fullName) }));
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));
    expect(await screen.findByText('Scoped department task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add my work' })).not.toBeInTheDocument();
  });

  it('instruments tab: materials list with quantity; the quantity opens each unit with all its fields', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul, an employee: the tab is open to everyone
    start('/');
    await user.click(await screen.findByRole('link', { name: 'Instruments' }));
    await screen.findByRole('heading', { level: 1, name: 'Instruments' });
    const rowOf = async (name) => (await screen.findByText(name, { selector: 'td strong' })).closest('tr');
    const unitRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
    const openUnits = async (name) => {
      await user.click(within(await rowOf(name)).getByRole('button', { name: new RegExp(`^Show the \\d+ ${name.replace(/[()]/g, '\\$&')} units$`) }));
      await screen.findByRole('heading', { level: 2, name });
    };

    // first page: one row per material (13 materials, 15 units), 5 per page
    expect(screen.getByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument();
    let pager = screen.getByRole('navigation', { name: 'Instrument pages' });
    expect(within(pager).getByText('Showing 1–5 of 13')).toBeInTheDocument();
    let row = await rowOf('Hammer drill machine');
    expect(screen.queryByRole('columnheader', { name: 'Material code' })).not.toBeInTheDocument();
    expect(within(row).queryByText('INS-010')).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Show the 3 Hammer drill machine units' })).toHaveTextContent('3');
    expect(within(row).getByLabelText('2 free')).toBeInTheDocument();
    expect(within(row).getByLabelText('1 in use')).toBeInTheDocument();
    expect(within(row).getByText('Office store')).toBeInTheDocument();
    expect(within(row).getByText('Talegaon')).toBeInTheDocument();

    // the quantity opens the units: each with status, where, who has it, history and actions
    await openUnits('Hammer drill machine');
    expect(unitRows()).toHaveLength(3);
    expect(unitRows().map((r) => r.querySelector('.inst-sr').textContent)).toEqual(['1', '2', '3']);
    expect(within(screen.getByRole('table')).getByText('Sneha Kulkarni')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('button', { name: 'Give to person' })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: '‹ All materials' }));
    expect(await screen.findByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument();

    // shift the moisture meter from Sneha to Priya
    await openUnits('Moisture meter');
    row = unitRows()[0];
    expect(within(row).getByText('Sneha Kulkarni')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Shift' }));
    let dialog = await screen.findByRole('dialog', { name: 'Shift Moisture meter' });
    await user.selectOptions(within(dialog).getByLabelText('Shift to'), 'Priya Sharma');
    await user.clear(within(dialog).getByLabelText('Site location'));
    await user.type(within(dialog).getByLabelText('Site location'), 'Baner');
    await user.click(within(dialog).getByRole('button', { name: 'Shift instrument' }));
    expect(await screen.findByText('“Moisture meter” shifted to Priya Sharma.')).toBeInTheDocument();
    row = unitRows()[0];
    expect(within(row).getByText('Priya Sharma')).toBeInTheDocument();
    expect(within(row).getByText('Baner')).toBeInTheDocument();

    // history: Amit → Sneha → Priya (now)
    await user.click(within(row).getByRole('button', { name: 'History of Moisture meter' }));
    dialog = await screen.findByRole('dialog', { name: 'Moisture meter — history' });
    expect(await within(dialog).findByText('Has it now')).toBeInTheDocument();
    ['Priya Sharma', 'Sneha Kulkarni', 'Amit Deshmukh'].forEach((name) => expect(within(dialog).getByText(name)).toBeInTheDocument());
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    // submit it: free in the office store
    await user.click(within(unitRows()[0]).getByRole('button', { name: 'Submit' }));
    dialog = await screen.findByRole('dialog', { name: 'Submit Moisture meter' });
    await user.click(within(dialog).getByRole('button', { name: 'Submit to office store' }));
    expect(await within(unitRows()[0]).findByText('Free')).toBeInTheDocument();
    expect(within(unitRows()[0]).getByRole('button', { name: 'Give to person' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '‹ All materials' }));

    // each unit has its own code: a new moisture meter cannot take INS-002 (a laser distance meter's code)
    await user.click(screen.getByRole('button', { name: '+ Add instrument' }));
    dialog = await screen.findByRole('dialog', { name: 'Add instrument' });
    await user.type(within(dialog).getByLabelText('Instrument name'), 'Moisture meter');
    await user.type(within(dialog).getByLabelText('Material code'), 'ins-002');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Material code INS-002 is already the code of a “Laser distance meter”');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('the next free one is INS-016');
    await user.click(within(dialog).getByRole('button', { name: 'Add instrument' }));
    expect(screen.getByRole('dialog', { name: 'Add instrument' })).toBeInTheDocument();   // not added
    await user.clear(within(dialog).getByLabelText('Material code'));
    await user.type(within(dialog).getByLabelText('Material code'), 'INS-016');   // a free code: fine
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    // add a new material with 3 units: all go to the office store
    await user.click(screen.getByRole('button', { name: '+ Add instrument' }));
    dialog = await screen.findByRole('dialog', { name: 'Add instrument' });
    await user.type(within(dialog).getByLabelText('Instrument name'), 'Grout pump');
    await user.type(within(dialog).getByLabelText('Make (company)'), 'Ajay Tools');
    await user.type(within(dialog).getByLabelText('Material code'), 'gp-01');
    const longInfo = 'Hand pump for grouting cracks and joints, with 2 hoses, pressure gauge, spare seals and a cleaning kit';
    await user.type(within(dialog).getByLabelText(/Instrument info/), longInfo);
    await user.clear(within(dialog).getByLabelText('Quantity'));
    await user.type(within(dialog).getByLabelText('Quantity'), '3');
    expect(within(dialog).queryByLabelText('Give it to')).not.toBeInTheDocument();
    expect(within(dialog).getByText('GP-01, GP-02, GP-03')).toBeInTheDocument();   // each unit its own code
    expect(within(dialog).getByText(/All 3 go to the office store/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add instrument' }));
    expect(await screen.findByText('3 × “Grout pump” added to the office store.')).toBeInTheDocument();

    // 14 materials now: the arrows at the top move the page too, in step with the bottom pager
    pager = screen.getByRole('navigation', { name: 'Instrument pages' });
    const top = screen.getByRole('navigation', { name: 'Instrument pages (top)' });
    expect(within(pager).getByText('Showing 1–5 of 14')).toBeInTheDocument();
    expect(screen.queryByText('Grout pump', { selector: 'td strong' })).not.toBeInTheDocument();
    await user.click(within(top).getByRole('button', { name: 'Next page' }));
    expect(within(top).getByText('6–10 of 14')).toBeInTheDocument();
    expect(within(pager).getByText('Showing 6–10 of 14')).toBeInTheDocument();
    await user.click(within(top).getByRole('button', { name: 'Previous page' }));
    expect(within(pager).getByText('Showing 1–5 of 14')).toBeInTheDocument();
    await user.click(within(pager).getByRole('button', { name: 'Page 3' }));
    expect(within(top).getByText('11–14 of 14')).toBeInTheDocument();
    row = await rowOf('Grout pump');
    expect(within(row).getByLabelText('3 free')).toBeInTheDocument();
    expect(within(row).getByLabelText('0 in use')).toBeInTheDocument();
    expect(within(row).getByText('Office store')).toBeInTheDocument();
    expect(within(row).queryByText(longInfo)).not.toBeInTheDocument();   // no info on the first page

    // open it: 3 units with all their fields
    await openUnits('Grout pump');
    expect(unitRows()).toHaveLength(3);
    expect(unitRows().map((r) => r.querySelector('.mat-code').textContent)).toEqual(['GP-01', 'GP-02', 'GP-03']);
    expect(within(unitRows()[0]).getByText('Ajay Tools')).toBeInTheDocument();
    // long info is cut to 2 lines; More / Less opens and closes it
    expect(within(unitRows()[0]).getByText(longInfo)).not.toHaveClass('is-open');
    await user.click(within(unitRows()[0]).getByRole('button', { name: 'More' }));
    expect(within(unitRows()[0]).getByText(longInfo)).toHaveClass('is-open');
    expect(within(unitRows()[0]).getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true');

    // add one more straight to a person, with the button at the top: inside a material it adds to that material
    expect(screen.getByRole('button', { name: '+ Add more units' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Grout pump' }));
    dialog = await screen.findByRole('dialog', { name: 'Add more Grout pump' });
    // the name is locked (same name = same material); the code is the next free one, and can be changed
    expect(within(dialog).getByLabelText('Instrument name')).toHaveValue('Grout pump');
    expect(within(dialog).getByLabelText('Instrument name')).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Material code')).toHaveValue('GP-04');
    expect(within(dialog).getByLabelText('Material code')).not.toHaveAttribute('readonly');
    await user.selectOptions(within(dialog).getByLabelText('Give it to'), 'Amit Deshmukh');
    await user.type(within(dialog).getByLabelText('Site location'), 'Talegaon');
    await user.click(within(dialog).getByRole('button', { name: 'Add instrument' }));
    expect(await screen.findByText('“Grout pump” added and given to Amit Deshmukh.')).toBeInTheDocument();
    await waitFor(() => expect(unitRows()).toHaveLength(4));
    expect(within(unitRows()[3]).getByText('Amit Deshmukh')).toBeInTheDocument();
    expect(within(unitRows()[3]).getByText('GP-04')).toBeInTheDocument();   // its own code
    expect(within(unitRows()[3]).getByRole('button', { name: 'History of Grout pump' })).toHaveTextContent(/^View$/);

    // edit one unit's make; who has it does not change
    await user.click(within(unitRows()[3]).getByRole('button', { name: 'Edit Grout pump' }));
    dialog = await screen.findByRole('dialog', { name: 'Edit Grout pump' });
    const make = within(dialog).getByLabelText('Make (company)');
    expect(make).toHaveValue('Ajay Tools');
    await user.clear(make);
    await user.type(make, 'Graco');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('“Grout pump” saved.')).toBeInTheDocument();
    expect(within(unitRows()[3]).getByText('Graco')).toBeInTheDocument();
    expect(within(unitRows()[3]).getByText('Amit Deshmukh')).toBeInTheDocument();

    // search on the materials list finds a material by its make
    await user.click(screen.getByRole('button', { name: '‹ All materials' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search instruments' }), 'elcometer');
    expect(await rowOf('Coating thickness gauge (DFT)')).toBeInTheDocument();
    expect(screen.queryByText('Grout pump', { selector: 'td strong' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Instrument pages' })).not.toBeInTheDocument();
  }, 20000);

  it('instruments tab: repair form, back from repair, and remove with a reason', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul
    start('/instruments');
    await screen.findByRole('heading', { level: 1, name: 'Instruments' });
    const unitRow = () => within(screen.getByRole('table')).getAllByRole('row')[1];
    await user.click(within((await screen.findByText('Laser distance meter', { selector: 'td strong' })).closest('tr'))
      .getByRole('button', { name: 'Show the 1 Laser distance meter units' }));
    await screen.findByRole('heading', { level: 2, name: 'Laser distance meter' });

    // repair the laser distance meter (Sneha has it at Pirangut)
    await user.click(within(unitRow()).getByRole('button', { name: 'Repair Laser distance meter' }));
    let dialog = await screen.findByRole('dialog', { name: 'Repair Laser distance meter' });
    expect(within(dialog).getByText(/takes it back from them/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('What is wrong'), 'Display not working');
    await user.type(within(dialog).getByLabelText('Repair shop / service centre'), 'Leica service, Camp');
    await user.type(within(dialog).getByLabelText('Estimated cost (₹)'), '900');
    await user.click(within(dialog).getByRole('button', { name: 'Send for repair' }));
    expect(await screen.findByText('“Laser distance meter” sent for repair to Leica service, Camp.')).toBeInTheDocument();
    expect(await within(unitRow()).findByText('Under repair')).toBeInTheDocument();
    expect(within(unitRow()).getByText('Leica service, Camp')).toBeInTheDocument();
    expect(within(unitRow()).queryByRole('button', { name: 'Shift' })).not.toBeInTheDocument();

    // back from repair: free in the office store
    await user.click(within(unitRow()).getByRole('button', { name: 'Back from repair' }));
    dialog = await screen.findByRole('dialog', { name: 'Laser distance meter back from repair' });
    await user.type(within(dialog).getByLabelText('Repair cost (₹)'), '750');
    await user.type(within(dialog).getByLabelText('What was done'), 'Display replaced');
    await user.click(within(dialog).getByRole('button', { name: 'Back in office store' }));
    expect(await within(unitRow()).findByText('Free')).toBeInTheDocument();
    expect(within(unitRow()).getByText('Office store')).toBeInTheDocument();

    // the history shows the repair with its cost
    await user.click(within(unitRow()).getByRole('button', { name: 'History of Laser distance meter' }));
    dialog = await screen.findByRole('dialog', { name: 'Laser distance meter — history' });
    expect(await within(dialog).findByText('Leica service, Camp')).toBeInTheDocument();
    expect(within(dialog).getByText(/cost ₹750: Display replaced/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));

    // remove: needs a reason; its only unit leaves, so the material leaves the list; it shows under "Removed"
    await user.click(within(unitRow()).getByRole('button', { name: 'Remove Laser distance meter' }));
    dialog = await screen.findByRole('dialog', { name: 'Remove Laser distance meter' });
    const removeBtn = within(dialog).getByRole('button', { name: 'Remove instrument' });
    expect(removeBtn).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Why is it removed'), 'Dropped from scaffolding');
    await user.click(removeBtn);
    expect(await screen.findByText('“Laser distance meter” removed from the list.')).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', { name: 'Quantity' })).toBeInTheDocument();
    expect(screen.queryByText('Laser distance meter', { selector: 'td strong' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Removed');
    const row = (await screen.findByText('Laser distance meter', { selector: 'td strong' })).closest('tr');
    expect(within(row).getByText('Rahul Patil')).toBeInTheDocument();
    expect(within(row).getByText('Dropped from scaffolding')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /Remove|Repair|Shift|Give/ })).not.toBeInTheDocument();
  });

  it('instruments tab: Edit on the first page changes the material for all its units; each keeps its own code', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul
    start('/instruments');
    await screen.findByRole('heading', { level: 1, name: 'Instruments' });
    const rowOf = async (name) => (await screen.findByText(name, { selector: 'td strong' })).closest('tr');

    await user.click(within(await rowOf('Hammer drill machine')).getByRole('button', { name: 'Edit Hammer drill machine (all units)' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit Hammer drill machine' });
    expect(within(dialog).getByText('3 units')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Make (company)')).toHaveValue('Bosch');
    await user.clear(within(dialog).getByLabelText('Instrument name'));
    await user.type(within(dialog).getByLabelText('Instrument name'), 'Hammer drill (800 W)');
    await user.clear(within(dialog).getByLabelText('Make (company)'));
    await user.type(within(dialog).getByLabelText('Make (company)'), 'Makita');
    await user.click(within(dialog).getByRole('button', { name: 'Save all 3 units' }));
    expect(await screen.findByText('“Hammer drill (800 W)” saved (all 3 units).')).toBeInTheDocument();

    // still one material with 3 units; each unit has the new name and make, and its own code
    const row = await rowOf('Hammer drill (800 W)');
    expect(screen.queryByText('Hammer drill machine', { selector: 'td strong' })).not.toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Show the 3 Hammer drill (800 W) units' }));
    await screen.findByRole('heading', { level: 2, name: 'Hammer drill (800 W)' });
    const units = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(units).toHaveLength(3);
    expect(units.map((r) => r.querySelector('.mat-code').textContent)).toEqual(['INS-010', 'INS-014', 'INS-015']);
    units.forEach((r) => expect(within(r).getByText('Makita')).toBeInTheDocument());
    expect(within(units[1]).getByText('Sneha Kulkarni')).toBeInTheDocument();   // who has it did not change
  });

  it('the Tasks page shows at most 5 cards in each lane', async () => {
    tokenStore.set('mock-1');   // admin: sees everyone's tasks
    start('/tasks?status=all');
    await screen.findByRole('heading', { level: 1, name: 'Tasks' });
    await waitFor(() => expect(document.querySelectorAll('.lane').length).toBeGreaterThan(0));
    document.querySelectorAll('.lane').forEach((lane) => {
      const total = Number(lane.querySelector('.count').textContent);
      expect(lane.querySelectorAll('.task-list > li').length).toBe(Math.min(5, total));
      expect(!!lane.querySelector('.pager-compact')).toBe(total > 5);
    });
  });

  it('admins can search employees on the Employees page and the dashboard', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');   // admin
    start('/employees');
    const search = await screen.findByRole('searchbox', { name: 'Search employees' });
    const table = screen.getByRole('table');
    await user.type(search, 'rahul');
    expect(within(table).getByRole('link', { name: 'Rahul Patil' })).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: 'Priya Sharma' })).not.toBeInTheDocument();
    // by employee code or department too
    await user.clear(search);
    await user.type(search, 'EMP-101');
    expect(within(table).getByRole('link', { name: 'Priya Sharma' })).toBeInTheDocument();
    expect(within(table).queryByRole('link', { name: 'Rahul Patil' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'nobody like this');
    expect(screen.getByText(/No employee matches/)).toBeInTheDocument();

    // the dashboard team list has the same search
    await user.click(screen.getByRole('link', { name: 'Dashboard' }));
    const teamSearch = await screen.findByRole('searchbox', { name: 'Search employee' });
    await user.type(teamSearch, 'sneha');
    const team = teamSearch.closest('section');
    expect(await within(team).findByText('Sneha Kulkarni')).toBeInTheDocument();
    expect(within(team).queryByText('Rahul Patil')).not.toBeInTheDocument();
  });

  it('full admins can set an admin home department separately from multiple access departments', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start('/employees');
    await user.click(await screen.findByRole('button', { name: 'Add employee' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Access' }), 'DEPARTMENT_ADMIN');

    const homeDepartment = screen.getByRole('textbox', { name: /Department/ });
    await user.type(homeDepartment, 'Purchase');
    await user.click(screen.getByRole('checkbox', { name: 'Accounts' }));
    await user.click(screen.getByRole('checkbox', { name: 'Projects' }));
    expect(homeDepartment).toHaveValue('Purchase');
    expect(screen.getByRole('checkbox', { name: 'Accounts' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Projects' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Purchase' })).not.toBeChecked();

    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Purchase Department Admin');
    await user.type(screen.getByRole('textbox', { name: 'Work email' }), 'purchase.admin@company.com');
    await user.type(screen.getByRole('textbox', { name: 'First password' }), 'Start@1234');
    await user.click(within(screen.getByRole('dialog', { name: 'Add employee' })).getByRole('button', { name: 'Add employee' }));
    expect(await screen.findByText('Department admin (manages: Accounts, Projects)')).toBeInTheDocument();
  });

  it('saving an existing admin as a Tech department admin keeps the Tech-only scope', async () => {
    tokenStore.set('mock-1');
    await employeeService.create({
      fullName: 'Tech Team Member', email: 'tech.employee@company.com', password: 'Start@1234',
      role: 'EMPLOYEE', department: 'Tech',
    });
    await employeeService.create({
      fullName: 'Existing Admin', email: 'existing.admin@company.com', password: 'Start@1234',
      role: 'ADMIN', department: 'Management',
    });
    const user = userEvent.setup();
    start('/employees');
    const row = (await screen.findByRole('row', { name: /Existing Admin/ }));
    await user.click(within(row).getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Existing Admin' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Access' }), 'DEPARTMENT_ADMIN');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Tech' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Department admin (manages: Tech)')).toBeInTheDocument();
    const login = await authService.login('existing.admin@company.com', 'Start@1234');
    tokenStore.set(login.token);
    expect((await employeeService.directory()).filter((person) => person.email !== 'existing.admin@company.com' && person.fullName !== 'Existing Admin').map((person) => person.department)).toEqual(['Tech']);
    expect((await employeeService.list()).map((person) => person.department)).toEqual(['Tech']);
    start('/');
    await screen.findByRole('heading', { level: 1, name: /Good/ });
    const departmentFilter = await screen.findByRole('combobox', { name: 'Department' });
    expect(departmentFilter).toHaveValue('Tech');
    expect(within(departmentFilter).getAllByRole('option')).toHaveLength(1);
    expect(within(departmentFilter).getByRole('option', { name: 'Tech' })).toBeInTheDocument();
  });

  it('an employee cannot open admin pages (sent back home)', async () => {
    tokenStore.set('mock-3');
    start('/employees');
    expect(await screen.findByRole('heading', { level: 1, name: /Good/ })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
  it('the employee profile goes back to the employee list', async () => {
    tokenStore.set('mock-1');
    start('/employees/3');
    const back = await screen.findByRole('link', { name: /All employees/ });
    expect(back).toHaveAttribute('href', '/employees');
  });

  it('admin employee detail reuses the employee profile dashboard and shows the add-image action', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start('/employees/3');

    expect(await screen.findByRole('heading', { level: 2, name: 'Rahul Patil' })).toBeInTheDocument();
    expect(screen.getByText('rahul@company.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add image' })).toBeInTheDocument();
    const photoButton = screen.getByRole('button', { name: 'Choose profile photo for Rahul Patil' });
    const photoInput = screen.getByLabelText('Choose profile photo');
    const openPicker = vi.spyOn(photoInput, 'click');
    await user.click(photoButton);
    expect(openPicker).toHaveBeenCalledOnce();
    expect(screen.queryByText('Add photo')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove image')).not.toBeInTheDocument();
    openPicker.mockRestore();
  });
});

describe('task page', () => {
  it('shows status, history and details in plain words', async () => {
    tokenStore.set('mock-1');
    start(`/tasks/${await idOf('Collect 3 quotations for plywood')}`); // waiting for review
    expect(await screen.findByRole('heading', { level: 1, name: 'Collect 3 quotations for plywood' })).toBeInTheDocument();
    expect(topTitle()).toBe('Task');
    const page = document.querySelector('.task-page');
    expect(page.textContent).not.toMatch(/\bWorking\b|\bSubmitted\b/);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send back' })).toBeInTheDocument();
  });
  it('marking a task done lets the person attach proof of work, shown on the task page', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');   // Rahul, own task with no review
    const task = await taskService.create({ title: 'Photo of the fixed gate', status: 'IN_PROGRESS' });
    start(`/tasks/${task.id}`);
    // note, then files, then Mark done: sent straight away, no extra window
    await user.type(await screen.findByLabelText('Notes'), 'Gate fixed');
    await user.upload(screen.getByLabelText(/Attach proof of work/),
      [new File(['photo'], 'gate.png', { type: 'image/png' }), new File(['%PDF'], 'bill.pdf', { type: 'application/pdf' })]);
    expect(screen.getByText('gate.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const proofs = (await screen.findByRole('heading', { name: 'Proof of work' })).closest('section');
    expect(await within(proofs).findByText('gate.png')).toBeInTheDocument();
    expect(within(proofs).getByText('bill.pdf')).toBeInTheDocument();
    expect((await taskService.get(task.id)).status).toBe('COMPLETED');
    expect((await taskService.attachments(task.id)).map((a) => a.fileName)).toEqual(['gate.png', 'bill.pdf']);
    expect((await taskService.activity(task.id)).some((a) => a.comment === 'Gate fixed')).toBe(true);
  });
  it('a note is added by pressing Enter, with no Add note button', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    const task = await taskService.create({ title: 'Note by Enter key', status: 'IN_PROGRESS' });
    start(`/tasks/${task.id}`);
    const box = await screen.findByLabelText('Notes');
    expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument();
    await user.type(box, 'Called the supplier{Enter}');
    await waitFor(async () => expect((await taskService.activity(task.id)).some((a) => a.comment === 'Called the supplier')).toBe(true));
    await waitFor(() => expect(box).toHaveValue(''));
  });
  it('send back without a note asks for one', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start(`/tasks/${await idOf('Collect 3 quotations for plywood')}`);
    await user.click(await screen.findByRole('button', { name: 'Send back' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Add a note/);
  });
});

describe('workflows (FMS) pages', () => {
  it('employee can open a scheduled daily FMS from the week calendar', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-4'); // Sneha is assigned to step 1 of the demo daily FMS
    start('/');
    await screen.findByRole('heading', { name: /Good morning|Good afternoon|Good evening/ });
    await user.click(screen.getByRole('tab', { name: 'Week' }));
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click((await screen.findAllByRole('button', { name: /Daily purchase cycle Scheduled/ }))[0]);
    expect(await pageTitle()).toBe('Daily purchase cycle');
  });

  it('the list has a New FMS button like other pages', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start('/workflows');
    await user.click(await screen.findByRole('button', { name: 'New FMS' }));
    expect(await pageTitle()).toBe('New FMS');
    expect(topTitle()).toBe('New FMS');
    const department = await screen.findByLabelText('Department (optional)');
    await waitFor(() => expect(within(department).getByRole('option', { name: 'Accounts' })).toBeInTheDocument());
    await user.selectOptions(department, 'Accounts');
    expect(department).toHaveValue('Accounts');
  });
  it('lets the FMS creator save the setup without assigning any people', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');
    start('/workflows/new');
    await user.click(await screen.findByLabelText('Save FMS without assigning anyone'));
    expect(screen.getByLabelText('Step 1: who')).toBeDisabled();
    expect(screen.getByLabelText('Step 1: who')).toHaveValue('');
    expect(screen.getByText('This saves the FMS setup only. Assign a person to every step before starting it.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('FMS name'), 'Unassigned setup');
    await user.type(screen.getByLabelText('Step 1: what'), 'Check request');
    await user.type(screen.getByLabelText('Step 2: what'), 'Approve request');
    await user.click(screen.getAllByRole('button', { name: 'Create FMS' }).at(-1));
    expect(await screen.findByRole('heading', { name: 'Unassigned setup' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start new' })).not.toBeInTheDocument();
    expect(screen.getByText(/Assign a person to every step before starting this FMS/)).toBeInTheDocument();
  });
  it('the edit page is titled Edit FMS in the top bar', async () => {
    tokenStore.set('mock-1');
    start('/workflows/1/edit');
    expect(await pageTitle()).toBe('Edit FMS');
    expect(topTitle()).toBe('Edit FMS');
  });
  it('employee can edit an FMS they can view', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-4'); // Sneha is assigned to step 1 of the first demo FMS
    start('/workflows/1');
    expect(await pageTitle()).toBe('Daily purchase cycle');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await pageTitle()).toBe('Edit FMS');
  });
  it('FMS sheet shows dates and times in the normal readable format', async () => {
    tokenStore.set('mock-1');
    start('/workflows/1');
    expect(await pageTitle()).toBe('Daily purchase cycle'); // same page heading layout as every other page
    expect(screen.getByRole('button', { name: 'Start new' })).toBeInTheDocument();
    const table = await screen.findByRole('table');
    await waitFor(() => expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(1));
    expect(table.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); // no raw ISO timestamps
  });
});

describe('assign a task form', () => {
  it.each([
    ['admin', 'mock-1'],
    ['employee', 'mock-3'],
  ])('shows the reviewer option when assigning as %s', async (_role, token) => {
    const user = userEvent.setup();
    tokenStore.set(token);
    start('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const reviewer = within(dialog).getByLabelText('Reviewed by');
    expect(reviewer).toBeDisabled();
    expect(reviewer).toHaveTextContent('Select assignee first');

    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    await user.click(within(assign).getByRole('checkbox', { name: 'Select all employees except me' }));
    expect(reviewer).toBeEnabled();
    expect(reviewer).toHaveValue(token === 'mock-1' ? '1' : '3');
    expect(within(assign).getByRole('checkbox', { name: /Me \(/ })).not.toBeChecked();
    expect(within(assign).getAllByRole('checkbox').filter((checkbox) => checkbox.checked)).toHaveLength(5);
  });

  it('switching from "me" to someone else picks a real reviewer', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3'); // Rahul
    start('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    const rahul = await within(assign).findByRole('checkbox', { name: /Me \(Rahul Patil\)/ });
    const priya = await within(assign).findByRole('checkbox', { name: /Priya Sharma/ });
    await user.click(rahul); // me
    expect(within(dialog).getByLabelText('Reviewed by')).toHaveValue('none');
    await user.click(rahul);
    await user.click(priya); // Priya
    const reviewer = within(dialog).getByLabelText('Reviewed by');
    expect(reviewer).toHaveValue('3');
    expect(within(dialog).getByText(/Priya Sharma will submit the work, and you will approve it/)).toBeInTheDocument();
  });
  it('creates the task and it shows in "I assigned"', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Send cement rate list');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    const amit = await within(assign).findByRole('checkbox', { name: /Amit Deshmukh/ });
    await user.click(amit);
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));
    const taskItem = (await screen.findByText('Send cement rate list')).closest('li');
    expect(within(taskItem).getByText('Reviewed by: Rahul Patil')).toBeInTheDocument();
  });
  it('lets the assigner choose no review for a task assigned to someone else', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Prepare an unreviewed task');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    await user.click(await within(assign).findByRole('checkbox', { name: /Amit Deshmukh/ }));

    const reviewer = within(dialog).getByLabelText('Reviewed by');
    expect(within(reviewer).getByRole('option', { name: 'No review needed' })).toBeInTheDocument();
    await user.selectOptions(reviewer, 'none');
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));

    await waitFor(async () => {
      const tasks = await taskService.list({ scope: 'created' });
      expect(tasks.find((task) => task.title === 'Prepare an unreviewed task')?.reviewer).toBeNull();
    });
  });
  it('picks people department-wise when assigning to several people', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-1');   // admin
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    // the list is grouped under department headings
    expect(await within(assign).findByRole('group', { name: 'Projects' })).toBeInTheDocument();

    await user.selectOptions(within(assign).getByRole('combobox', { name: 'Department' }), 'Projects (2)');
    expect(within(assign).getByRole('checkbox', { name: /Sneha Kulkarni/ })).toBeInTheDocument();
    expect(within(assign).getByRole('checkbox', { name: /Amit Deshmukh/ })).toBeInTheDocument();
    expect(within(assign).queryByRole('checkbox', { name: /Priya Sharma/ })).not.toBeInTheDocument();

    await user.click(within(assign).getByRole('checkbox', { name: 'Select everyone in Projects (2)' }));
    expect(within(assign).getByRole('checkbox', { name: /Sneha Kulkarni/ })).toBeChecked();
    expect(within(assign).getByRole('checkbox', { name: /Amit Deshmukh/ })).toBeChecked();
    expect(within(assign).getByText('2 selected')).toBeInTheDocument();

    // choices stay when switching department; untick the whole department again
    await user.selectOptions(within(assign).getByRole('combobox', { name: 'Department' }), 'Accounts (1)');
    await user.click(within(assign).getByRole('checkbox', { name: /Priya Sharma/ }));
    expect(within(assign).getByText('3 selected')).toBeInTheDocument();
    await user.selectOptions(within(assign).getByRole('combobox', { name: 'Department' }), 'Projects (2)');
    await user.click(within(assign).getByRole('checkbox', { name: 'Select everyone in Projects (2)' }));
    expect(within(assign).getByText('1 selected')).toBeInTheDocument();
  });

  it('creates independent task copies for multiple selected people', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Prepare shared site checklist');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    const priya = await within(assign).findByRole('checkbox', { name: /Priya Sharma/ });
    const sneha = await within(assign).findByRole('checkbox', { name: /Sneha Kulkarni/ });
    await user.click(priya);
    await user.click(sneha);
    expect(within(dialog).getByText(/A separate task will be created for each selected person/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));

    await waitFor(() => expect(screen.getAllByText('Prepare shared site checklist')).toHaveLength(2));
    const taskItems = screen.getAllByText('Prepare shared site checklist').map((title) => title.closest('li'));
    taskItems.forEach((taskItem) => {
      expect(within(taskItem).getByText('Reviewed by: Rahul Patil')).toBeInTheDocument();
    });
  });

  it('creates a weekly repeating task and reviewer for each selected person', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly shared safety check');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    await user.click(await within(assign).findByRole('checkbox', { name: /Priya Sharma/ }));
    await user.click(await within(assign).findByRole('checkbox', { name: /Sneha Kulkarni/ }));
    await user.selectOptions(within(dialog).getByLabelText('Repeat'), 'WEEKLY');
    expect(within(dialog).getByLabelText('Reviewed by')).toHaveValue('3');
    await user.click(within(dialog).getByRole('button', { name: 'Create repeating task' }));

    await waitFor(async () => {
      const templates = await recurringService.list();
      expect(templates.filter((template) => template.title === 'Weekly shared safety check')).toHaveLength(2);
    });
  });
  it('weekly task: start time, then due date and time (no minutes); each copy is due that many days after it starts', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly stock count');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    await user.click(await within(assign).findByRole('checkbox', { name: /Priya Sharma/ }));
    await user.selectOptions(within(dialog).getByLabelText('Repeat'), 'WEEKLY');
    await user.selectOptions(within(dialog).getByLabelText('Every'), 'MONDAY');
    expect(within(dialog).queryByLabelText('Duration (minutes)')).not.toBeInTheDocument();

    const startDay = within(dialog).getByLabelText('Due date').getAttribute('min');   // first Monday
    const due = new Date(`${startDay}T00:00`);
    due.setDate(due.getDate() + 2);                                                     // Wednesday
    const dueDay = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    fireEvent.change(within(dialog).getByLabelText('Due date'), { target: { value: dueDay } });
    fireEvent.change(within(dialog).getByLabelText('Due time'), { target: { value: '17:00' } });
    expect(within(dialog).getByText(/starts Monday 09:30 and is due Wednesday 17:00/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create repeating task' }));

    await waitFor(async () => {
      const template = (await recurringService.list()).find((t) => t.title === 'Weekly stock count');
      expect(template).toMatchObject({ frequency: 'WEEKLY', dayOfWeek: 'MONDAY', scheduledTime: '09:30', durationMinutes: null, dueDaysAfter: 2 });
      expect(template.dueTime.slice(0, 5)).toBe('17:00');
    });
  });
  it('daily task: only start date, start time, due date and due time (no minutes, no checkbox)', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Daily site photo');
    await user.click(await within(within(dialog).getByRole('group', { name: 'Assign to' })).findByRole('checkbox', { name: /Priya Sharma/ }));
    await user.selectOptions(within(dialog).getByLabelText('Repeat'), 'DAILY');
    for (const name of ['Start date', 'Start time', 'Due date', 'Due time']) expect(within(dialog).getByLabelText(name)).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Duration/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /scheduled start|start time and/i })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Due time'), { target: { value: '12:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Create repeating task' }));

    await waitFor(async () => {
      const template = (await recurringService.list()).find((t) => t.title === 'Daily site photo');
      expect(template).toMatchObject({ frequency: 'DAILY', scheduledTime: '09:30', durationMinutes: null, dueDaysAfter: 0 });
      expect(template.dueTime.slice(0, 5)).toBe('12:00');
    });
  });
  it('creates repeating tasks without a reviewer when no review is selected', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3');
    start('/tasks?scope=created');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    await user.type(within(dialog).getByLabelText('Title'), 'Weekly task without review');
    const assign = within(dialog).getByRole('group', { name: 'Assign to' });
    await user.click(await within(assign).findByRole('checkbox', { name: /Priya Sharma/ }));
    await user.selectOptions(within(dialog).getByLabelText('Reviewed by'), 'none');
    await user.selectOptions(within(dialog).getByLabelText('Repeat'), 'WEEKLY');
    await user.click(within(dialog).getByRole('button', { name: 'Create repeating task' }));

    await waitFor(async () => {
      const templates = await recurringService.list();
      expect(templates.find((template) => template.title === 'Weekly task without review')?.reviewer).toBeNull();
      const copies = (await taskService.list({ scope: 'created' }))
        .filter((task) => task.title === 'Weekly task without review');
      expect(copies.length).toBeGreaterThan(0);
      copies.forEach((task) => expect(task.reviewer).toBeNull());
    });
  });
});

describe('bulk task approval', () => {
  it('lets a reviewer select all submitted tasks and approve them together', async () => {
    tokenStore.set('mock-1');
    const first = await taskService.create({ title: 'Bulk approval task one', assigneeId: 2, reviewerId: 3 });
    const second = await taskService.create({ title: 'Bulk approval task two', assigneeId: 4, reviewerId: 3 });

    tokenStore.set('mock-2');
    await taskService.changeStatus(first.id, 'IN_PROGRESS');
    await taskService.changeStatus(first.id, 'SUBMITTED');
    tokenStore.set('mock-4');
    await taskService.changeStatus(second.id, 'IN_PROGRESS');
    await taskService.changeStatus(second.id, 'SUBMITTED');

    tokenStore.set('mock-3');
    const user = userEvent.setup();
    start('/tasks?scope=review&status=SUBMITTED');
    expect(await screen.findByText('Bulk approval task one')).toBeInTheDocument();
    expect(await screen.findByText('Bulk approval task two')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Select all submitted tasks/ }));
    await user.click(screen.getByRole('button', { name: /Approve selected \(\d+\)/ }));

    await waitFor(async () => {
      expect((await taskService.get(first.id)).status).toBe('COMPLETED');
      expect((await taskService.get(second.id)).status).toBe('COMPLETED');
    });
    expect(screen.queryByText('Bulk approval task one')).not.toBeInTheDocument();
    expect(screen.queryByText('Bulk approval task two')).not.toBeInTheDocument();
  });
});

describe('task attachment preview', () => {
  it('opens the uploaded image in a larger preview from the task detail page', async () => {
    tokenStore.set('mock-1');
    const task = await taskService.create({
      title: 'Review attached plan',
      assigneeId: 2,
      reviewerId: 1,
      image: 'dGVzdC1pbWFnZQ==',
    });
    const user = userEvent.setup();
    start(`/tasks/${task.id}`);

    expect(await screen.findByRole('img', { name: 'Task reference' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'See attachment' }));
    const preview = await screen.findByRole('dialog', { name: 'Task attachment' });
    expect(within(preview).getByRole('img', { name: 'Task attachment' })).toBeInTheDocument();
    await user.click(within(preview).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Task attachment' })).not.toBeInTheDocument();
  });
});

describe('FMS sheet: fill the form where you work', () => {
  it('step 1 person sees the entry form on the sheet and starting works', async () => {
    const user = userEvent.setup();
    const { workflowService } = await import('@/services/index.js');
    tokenStore.set('mock-1');
    const wf = await workflowService.create({
      name: 'Gate pass', frequency: 'DAILY', startTime: '00:01', endTime: '23:59',
      formFields: [
        { label: 'Vehicle number', type: 'text', required: true },
        { label: 'Driver name', type: 'text', required: false },
        { label: 'Site', type: 'text', required: false },
        { label: 'Purpose', type: 'text', required: false },
      ],
      steps: [
        { title: 'Write gate pass', assigneeId: 3, hours: 1, checklist: ['Verify vehicle registration against records', 'Confirm driver identity'] },
        { title: 'Sign gate pass', assigneeId: 2, hours: 1 },
      ],
    });
    const run = (await workflowService.runs()).find((r) => r.workflowId === wf.id);
    if (!run) return; // Sunday or office holiday: nothing scheduled today
    tokenStore.set('mock-3'); // Rahul, step 1
    start(`/workflows/${wf.id}`);
    const box = await screen.findByLabelText(/Vehicle number/);
    const table = screen.getByRole('table');
    // #, Timestamp, Filled by + 4 form fields
    expect(table.querySelector('thead tr.fms-sheet-header th.trigger').colSpan).toBe(7);
    expect(table.querySelectorAll('colgroup col')).toHaveLength(16);
    expect(within(table).getByText('Verify vehicle registration against records')).toBeInTheDocument();
    expect(screen.getByText('0 date-wise entries in selected dates')).toBeInTheDocument();
    expect(screen.getByText('No entries in these dates.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    await user.type(box, 'MH12 AB 1234');
    await user.type(screen.getByLabelText(/Driver name/), 'Amit');
    await user.type(screen.getByLabelText(/^Site/), 'Pune');
    await user.type(screen.getByLabelText(/Purpose/), 'Delivery');
    await user.click(screen.getByRole('button', { name: 'Submit form and start work' }));
    expect(await screen.findByRole('button', { name: /Mark done/ })).toBeInTheDocument();
    expect(screen.getByText('1 date-wise entries in selected dates')).toBeInTheDocument();
    expect(screen.getByText('MH12 AB 1234')).toBeInTheDocument();
    expect((await workflowService.run(run.id)).formData).toEqual({
      f1: 'MH12 AB 1234', f2: 'Amit', f3: 'Pune', f4: 'Delivery',
    });
  });
});
