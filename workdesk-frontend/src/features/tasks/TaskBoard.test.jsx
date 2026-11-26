import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TaskBoard from './TaskBoard.jsx';

const task = (id, extra = {}) => ({
  id, title: `Task ${id}`, status: 'TODO', priority: 'MEDIUM', dueAt: null, assignee: { id: 1, fullName: 'Priya Sharma' }, ...extra,
});

const board = (tasks, props = {}) => render(
  <MemoryRouter><TaskBoard tasks={tasks} onOpen={() => {}} cardLayout columns pageSize={5} {...props} /></MemoryRouter>,
);
const titles = (lane) => [...lane.querySelectorAll('.task-title')].map((n) => n.textContent);

describe('TaskBoard pages', () => {
  it('shows 5 cards per lane and pages through the rest with ‹ ›', async () => {
    const user = userEvent.setup();
    board(Array.from({ length: 12 }, (_, k) => task(k + 1)));
    const pager = screen.getByRole('navigation', { name: 'No due date pages' });
    const lane = pager.closest('.lane');
    expect(lane.querySelector('.count')).toHaveTextContent('12');
    expect(titles(lane)).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Task 5']);
    expect(within(pager).getByText('1–5 of 12')).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Previous page' })).toBeDisabled();

    await user.click(within(pager).getByRole('button', { name: 'Next page' }));
    expect(titles(lane)).toEqual(['Task 6', 'Task 7', 'Task 8', 'Task 9', 'Task 10']);
    await user.click(within(pager).getByRole('button', { name: 'Next page' }));
    expect(titles(lane)).toEqual(['Task 11', 'Task 12']);
    expect(within(pager).getByText('11–12 of 12')).toBeInTheDocument();
    expect(within(pager).getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('each lane has its own pages, and a lane with 5 or fewer has no page buttons', async () => {
    const user = userEvent.setup();
    const done = Array.from({ length: 3 }, (_, k) => task(100 + k, { status: 'COMPLETED' }));
    board([...Array.from({ length: 7 }, (_, k) => task(k + 1)), ...done]);
    expect(screen.queryByRole('navigation', { name: 'Done and cancelled pages' })).not.toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'No due date pages' });
    await user.click(within(pager).getByRole('button', { name: 'Next page' }));
    expect(titles(pager.closest('.lane'))).toEqual(['Task 6', 'Task 7']);
    // the Done lane did not move
    const doneLane = document.querySelector('.lane-closed');
    expect(titles(doneLane)).toEqual(['Task 100', 'Task 101', 'Task 102']);
  });

  it('a lane on its last page goes back when its list shrinks', async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 7 }, (_, k) => task(k + 1));
    const { rerender } = board(all);
    const pager = screen.getByRole('navigation', { name: 'No due date pages' });
    await user.click(within(pager).getByRole('button', { name: 'Next page' }));
    rerender(<MemoryRouter><TaskBoard tasks={all.slice(0, 4)} onOpen={() => {}} cardLayout columns pageSize={5} /></MemoryRouter>);
    expect(titles(document.querySelector('.lane'))).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 4']);
  });
});
