import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { recurringService } from '@/services/index.js';
import RepeatingTaskList from './RepeatingTaskList.jsx';

vi.mock('@/services/index.js', () => ({
  recurringService: { list: vi.fn() },
}));

describe('RepeatingTaskList', () => {
  beforeEach(() => {
    recurringService.list.mockResolvedValue([
      { id: 1, title: 'Monthly report', frequency: 'MONTHLY', startDate: '2026-04-15', dayOfWeek: null, dueTime: '18:00:00', active: true },
      { id: 2, title: 'Annual review', frequency: 'YEARLY', startDate: '2026-04-20', dayOfWeek: null, dueTime: '18:00:00', active: true },
      { id: 3, title: 'Weekly report', frequency: 'WEEKLY', startDate: null, dayOfWeek: null, dueTime: '18:00:00', active: true },
    ]);
  });

  it('renders monthly and yearly schedules without crashing on a missing weekday', async () => {
    render(<RepeatingTaskList refreshKey={0} />);

    expect(await screen.findByText(/Monthly on day 15/)).toBeInTheDocument();
    expect(screen.getByText(/Yearly on 2026-04-20/)).toBeInTheDocument();
    expect(screen.getByText(/Every —/)).toBeInTheDocument();
  });
});
