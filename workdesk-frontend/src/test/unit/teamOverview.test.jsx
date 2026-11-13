import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamOverview from '@/features/dashboard/TeamOverview.jsx';
import { reportService } from '@/services/reportService.js';

const member = (id, fullName, department) => ({
  employee: { id, fullName, department, designation: '', active: true },
  range: { todo: 0, inProgress: 0, done: 0 },
  rangeTasks: [],
  rangeOverdue: 0,
  month: { score: 0 },
});

describe('TeamOverview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('filters team cards by an existing employee department', async () => {
    vi.spyOn(reportService, 'team').mockResolvedValue([
      member(1, 'Priya Sharma', 'Accounts'),
      member(2, 'Rahul Patil', 'Purchase'),
    ]);

    render(
      <MemoryRouter>
        <TeamOverview
          employees={[
            { id: 1, fullName: 'Priya Sharma', role: 'EMPLOYEE', department: 'Accounts' },
            { id: 2, fullName: 'Rahul Patil', role: 'EMPLOYEE', department: 'Purchase' },
            { id: 3, fullName: 'System Admin', role: 'ADMIN', department: 'Management' },
          ]}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Priya Sharma')).toBeInTheDocument();
    const departmentSelect = screen.getByRole('combobox', { name: 'Department' });
    expect(departmentSelect).toHaveTextContent('Accounts');
    expect(departmentSelect).toHaveTextContent('Purchase');
    expect(departmentSelect).toHaveTextContent('Management');

    fireEvent.change(departmentSelect, { target: { value: 'Purchase' } });

    expect(screen.getByText('Rahul Patil')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument());
  });

  it('shows administrator profiles alongside employee profiles', async () => {
    vi.spyOn(reportService, 'team').mockResolvedValue([
      member(2, 'Priya Sharma', 'Accounts'),
    ]);

    render(
      <MemoryRouter>
        <TeamOverview
          employees={[
            { id: 1, fullName: 'System Admin', department: 'Management', designation: 'Administrator', role: 'ADMIN', active: true },
            { id: 2, fullName: 'Priya Sharma', department: 'Accounts', role: 'EMPLOYEE', active: true },
          ]}
        />
      </MemoryRouter>,
    );

    const adminProfile = await screen.findByRole('link', { name: /System Admin/ });
    expect(adminProfile).toHaveAttribute('href', '/employees/1');
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });
});
