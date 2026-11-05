// Integration: screens → services → http → demo backend (same rules as the real API).
import { describe, expect, it } from 'vitest';
import { authService, employeeService, profilePhotoService } from '@/services/index.js';
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
