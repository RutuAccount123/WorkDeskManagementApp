// Full app in a browser-like page: sign in, move around, check every screen uses the same format.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/app/App.jsx';
import { ADMIN_NAV, EMPLOYEE_NAV } from '@/config/navigation.js';
import { tokenStore } from '@/services/http.js';
import { authService, employeeService, recurringService, taskService } from '@/services/index.js';

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
    expect(within(sidebar).queryByRole('link', { name: /Workflows|Repeating tasks/ })).not.toBeInTheDocument();
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
    expect(within(dialog).queryByLabelText('Repeat')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Title'), 'Scoped department task');
    await user.click(within(assign).getByRole('checkbox', { name: new RegExp(assignee.fullName) }));
    await user.click(within(dialog).getByRole('button', { name: 'Assign task' }));
    expect(await screen.findByText('Scoped department task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add my work' })).not.toBeInTheDocument();
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
    expect(await screen.findByText('Department admin (view-only: Accounts, Projects)')).toBeInTheDocument();
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

    expect(await screen.findByText('Department admin (view-only: Tech)')).toBeInTheDocument();
    const login = await authService.login('existing.admin@company.com', 'Start@1234');
    tokenStore.set(login.token);
    expect((await employeeService.directory()).map((person) => person.department)).toEqual(['Tech']);
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
    expect(table.querySelector('thead tr.fms-sheet-header th.trigger').colSpan).toBe(6);
    expect(table.querySelectorAll('colgroup col')).toHaveLength(15);
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
