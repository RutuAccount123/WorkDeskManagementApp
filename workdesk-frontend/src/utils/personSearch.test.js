import { describe, expect, it } from 'vitest';
import { matchesPerson } from './personSearch.js';

const rahul = { fullName: 'Rahul Patil', employeeCode: 'EMP-102', department: 'Purchase', designation: 'Purchase Officer', email: 'rahul@company.com' };

describe('employee search', () => {
  it('matches name, code, department, designation and email, ignoring capitals', () => {
    expect(matchesPerson(rahul, 'RAHUL')).toBe(true);
    expect(matchesPerson(rahul, 'emp-102')).toBe(true);
    expect(matchesPerson(rahul, 'purchase')).toBe(true);
    expect(matchesPerson(rahul, 'officer')).toBe(true);
    expect(matchesPerson(rahul, 'rahul@')).toBe(true);
  });

  it('needs every word to match, and an empty search shows everyone', () => {
    expect(matchesPerson(rahul, '  rahul   purchase ')).toBe(true);
    expect(matchesPerson(rahul, 'rahul accounts')).toBe(false);
    expect(matchesPerson(rahul, '')).toBe(true);
  });
});
