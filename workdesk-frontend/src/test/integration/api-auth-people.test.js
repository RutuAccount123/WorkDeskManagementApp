// Integration: screens → services → http → demo backend (same rules as the real API).
import { describe, expect, it } from 'vitest';
import { authService, employeeService, profilePhotoService, reportService, taskService } from '@/services/index.js';
import { http, tokenStore } from '@/services/http.js';
import { ADMIN, PRIYA, signIn } from '../helpers.js';

describe('sign in', () => {
  it('admin and employee get the right role, never the password', async () => {
    const res = await authService.login(' Admin@Company.com ', 'Admin@123');
    expect(res.token).toBeTruthy();
    expect(res.user.role).toBe('ADMIN');
    expect(res.user).not.toHaveProperty('password');
    const emp = await authService.login(PRIYA, 'Employee@123');
    expect(emp.user.role).toBe('EMPLOYEE');
  });
  it('rejects a wrong password and an inactive person', async () => {
    await expect(authService.login(ADMIN, 'wrong')).rejects.toThrow('Invalid email or password');
    await signIn(ADMIN);
    await employeeService.setActive(2, false);
    tokenStore.clear();
    await expect(authService.login(PRIYA, 'Employee@123')).rejects.toThrow('Invalid email or password');
  });
  it('me returns the signed-in person', async () => {
    await signIn(PRIYA);
    expect((await authService.me()).fullName).toBe('Priya Sharma');
  });
  it('change password checks the old one and the length', async () => {
    await signIn(PRIYA);
    await expect(authService.changePassword('bad', 'NewPass@123')).rejects.toThrow('Current password is incorrect');
    await expect(authService.changePassword('Employee@123', 'short')).rejects.toThrow(/at least 8/);
    await authService.changePassword('Employee@123', 'NewPass@123');
    tokenStore.clear();
    expect((await authService.login(PRIYA, 'NewPass@123')).user.id).toBe(2);
  });
});

describe('people & employees', () => {
  it('everyone can read the people list (active only, sorted)', async () => {
    await signIn(PRIYA);
    const people = await employeeService.directory();
    expect(people.map((p) => p.fullName)).toEqual(['Amit Deshmukh', 'Priya Sharma', 'Rahul Patil', 'Sneha Kulkarni', 'System Admin']);
  });
  it('only admin can open full employee records', async () => {
    await signIn(PRIYA);
    await expect(employeeService.list()).rejects.toThrow('You do not have permission');
  });
  it('admin adds, edits and protects employees', async () => {
    await signIn(ADMIN);
    const e = await employeeService.create({ fullName: 'Neha Joshi', email: 'NEHA@company.com', password: 'Start@1234', role: 'EMPLOYEE', department: 'HR' });
    expect(e.email).toBe('neha@company.com');
    await expect(employeeService.create({ fullName: 'Dup', email: 'neha@company.com', password: 'Start@1234', role: 'EMPLOYEE' }))
      .rejects.toThrow('already exists');
    await expect(employeeService.create({ fullName: 'Short', email: 's@c.com', password: 'x', role: 'EMPLOYEE' })).rejects.toThrow(/8 characters/);
    const upd = await employeeService.update(e.id, { ...e, designation: 'HR Executive' });
    expect(upd.designation).toBe('HR Executive');
    await expect(employeeService.setActive(1, false)).rejects.toThrow('cannot deactivate your own account');
    await expect(employeeService.update(1, { fullName: 'System Admin', email: ADMIN, role: 'EMPLOYEE' })).rejects.toThrow('own admin role');
  });
  it('department admins can view only their selected departments, independent of their own department', async () => {
    await signIn(ADMIN);
    await employeeService.create({
      fullName: 'Accounts Department Admin', email: 'accounts.admin@company.com', password: 'Start@1234',
      role: 'ADMIN', department: 'Purchase', departmentAdmin: true, accessibleDepartments: ['Accounts', 'Projects'],
    });

    await signIn('accounts.admin@company.com', 'Start@1234');
    const people = await employeeService.directory();
    // the people they can assign to: their departments, plus themselves
    expect(people.map((person) => person.department)).toEqual(expect.arrayContaining(['Accounts', 'Projects', 'Projects', 'Purchase']));
    expect(people).toHaveLength(4);
    expect(people.filter((person) => person.department === 'Purchase').map((person) => person.fullName)).toEqual(['Accounts Department Admin']);
    expect((await employeeService.list()).every((person) => ['Accounts', 'Projects'].includes(person.department))).toBe(true);
    await expect(employeeService.get(3)).rejects.toThrow('Employee not found');
    expect((await reportService.team()).every((member) => ['Accounts', 'Projects'].includes(member.employee.department))).toBe(true);
    expect((await taskService.list({ scope: 'all' })).every((task) => ['Accounts', 'Projects'].includes(task.assignee.department))).toBe(true);
    await expect(employeeService.create({
      fullName: 'Blocked Person', email: 'blocked@company.com', password: 'Start@1234', role: 'EMPLOYEE',
    })).rejects.toThrow('permission');
    const assignable = people.find((person) => person.role === 'EMPLOYEE');
    const createdTask = await taskService.create({
      title: 'Department-scoped assignment', assigneeId: assignable.id, noReview: true,
    });
    expect(['Accounts', 'Projects']).toContain(createdTask.assignee.department);
    expect(createdTask.reviewer).toBeNull();
    // department admins act as admins on their departments' work
    expect((await taskService.changeStatus(createdTask.id, 'IN_PROGRESS')).status).toBe('IN_PROGRESS');
    await expect(taskService.create({
      title: 'Out-of-scope assignment', assigneeId: 3, noReview: true,
    })).rejects.toThrow('departments you can access');
    await expect(taskService.createForAssignees([assignable.id, 3], {
      title: 'Partially out-of-scope batch', noReview: true,
    })).rejects.toThrow('departments you can access');
    expect((await taskService.list({ scope: 'created' }))
      .some((task) => task.title === 'Partially out-of-scope batch')).toBe(false);
  });
  it('updating an existing admin to department admin restricts them to the selected department', async () => {
    await signIn(ADMIN);
    await employeeService.create({
      fullName: 'Tech Team Member', email: 'tech.employee@company.com', password: 'Start@1234',
      role: 'EMPLOYEE', department: 'Tech',
    });
    const existingAdmin = await employeeService.create({
      fullName: 'Existing Admin', email: 'existing.admin@company.com', password: 'Start@1234',
      role: 'ADMIN', department: 'Management',
    });
    const updated = await employeeService.update(existingAdmin.id, {
      ...existingAdmin,
      department: 'Management',
      departmentAdmin: true,
      accessibleDepartments: ['Tech'],
    });
    expect(updated.department).toBe('Management');
    expect(updated.accessibleDepartments).toEqual(['Tech']);

    await signIn('existing.admin@company.com', 'Start@1234');
    expect((await employeeService.directory()).filter((person) => person.email !== 'existing.admin@company.com' && person.fullName !== 'Existing Admin').map((person) => person.department)).toEqual(['Tech']);
    expect((await employeeService.list()).map((person) => person.department)).toEqual(['Tech']);
  });
  it('admin can add and manage a photo on an employee profile', async () => {
    await signIn(ADMIN);
    const employee = await employeeService.create({
      fullName: 'Photo Employee', email: 'photo.employee@company.com', password: 'Start@1234', role: 'EMPLOYEE',
    });
    await profilePhotoService.save('AQID', employee.id);
    const photo = await http(`/api/employees/${employee.id}/photo`, { raw: true });
    expect(photo.status).toBe(200);
    expect(photo.headers.get('content-type')).toBe('image/jpeg');

    await signIn(PRIYA);
    await expect(profilePhotoService.get(employee.id)).rejects.toThrow('permission');
    await signIn(ADMIN);
    await profilePhotoService.remove(employee.id);
    expect(await profilePhotoService.get(employee.id)).toBeNull();
  });
  it('a missing name gives a clear error, not a crash', async () => {
    await signIn(ADMIN);
    await expect(employeeService.update(2, { email: PRIYA, role: 'EMPLOYEE', fullName: '' })).rejects.toThrow('fullName: must not be blank');
  });
});
