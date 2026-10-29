// Full app in a browser-like page: sign in, move around, check every screen uses the same format.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/app/App.jsx';
import { ADMIN_NAV, EMPLOYEE_NAV } from '@/config/navigation.js';
import { tokenStore } from '@/services/http.js';
import { taskService } from '@/services/index.js';

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
      expect(await pageTitle()).toBe(item.label);
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

describe('permissions in the screens', () => {
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
  it('switching from "me" to someone else picks a real reviewer', async () => {
    const user = userEvent.setup();
    tokenStore.set('mock-3'); // Rahul
    start('/tasks');
    await user.click(await screen.findByRole('button', { name: 'Assign a task' }));
    const dialog = await screen.findByRole('dialog', { name: 'Assign a task' });
    const assign = within(dialog).getByLabelText('Assign to');
    await waitFor(() => expect(within(assign).getAllByRole('option').length).toBeGreaterThan(2));
    await user.selectOptions(assign, '3'); // me
    expect(within(dialog).getByLabelText('Reviewed by')).toHaveValue('none');
    await user.selectOptions(assign, '2'); // Priya
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
    const assign = within(dialog).getByLabelText('Assign to');
    await waitFor(() => expect(within(assign).getAllByRole('option').length).toBeGreaterThan(2));
    await user.selectOptions(assign, '5');
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));
    expect(await screen.findByText('Send cement rate list')).toBeInTheDocument();
  });
});

describe('FMS sheet: fill the form where you work', () => {
  it('step 1 person sees the entry form on the sheet and starting works', async () => {
    const user = userEvent.setup();
    const { workflowService } = await import('@/services/index.js');
    tokenStore.set('mock-1');
    const wf = await workflowService.create({
      name: 'Gate pass', frequency: 'DAILY', startTime: '00:01', endTime: '23:59',
      formFields: [{ label: 'Vehicle number', type: 'text', required: true }],
      steps: [{ title: 'Write gate pass', assigneeId: 3, hours: 1 }, { title: 'Sign gate pass', assigneeId: 2, hours: 1 }],
    });
    const run = (await workflowService.runs()).find((r) => r.workflowId === wf.id);
    if (!run) return; // Sunday or office holiday: nothing scheduled today
    tokenStore.set('mock-3'); // Rahul, step 1
    start(`/workflows/${wf.id}`);
    const box = await screen.findByLabelText(/Vehicle number/);
    expect(screen.queryByRole('button', { name: 'Start work' })).not.toBeInTheDocument();
    await user.type(box, 'MH12 AB 1234');
    await user.click(screen.getByRole('button', { name: 'Submit form and start work' }));
    expect(await screen.findByRole('button', { name: /Mark done/ })).toBeInTheDocument();
    expect((await workflowService.run(run.id)).formData).toEqual({ f1: 'MH12 AB 1234' });
  });
});
