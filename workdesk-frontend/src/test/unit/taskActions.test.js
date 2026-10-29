import { describe, expect, it } from 'vitest';
import { actionsFor, yourTurn } from '@/features/tasks/taskActions.js';

const P = (id, fullName) => ({ id, fullName });
const admin = P(1, 'System Admin');
const priya = P(2, 'Priya Sharma');
const rahul = P(3, 'Rahul Patil');
const base = (over) => ({ id: 9, title: 'X', status: 'TODO', assignee: priya, createdBy: admin, reviewer: admin, ...over });
const labels = (task, user, isAdmin = false) => actionsFor(task, user, isAdmin).map((a) => a.label);

describe('actionsFor: which buttons each person sees', () => {
  it('assignee: start, then submit to the reviewer', () => {
    expect(labels(base(), priya)).toEqual(['Start work']);
    expect(labels(base({ status: 'IN_PROGRESS' }), priya)).toEqual(['Submit to System']);
    expect(labels(base({ status: 'SUBMITTED' }), priya)).toEqual([]);
  });
  it('reviewer: approve or send back (send back needs a note)', () => {
    const acts = actionsFor(base({ status: 'SUBMITTED', reviewer: rahul, createdBy: rahul }), rahul, false);
    expect(acts.map((a) => a.label)).toEqual(['Approve', 'Send back', 'Cancel task']);
    expect(acts.find((a) => a.to === 'REOPENED').needsComment).toBe(true);
  });
  it('own work with no reviewer: person can close it', () => {
    const own = base({ createdBy: priya, reviewer: null });
    expect(labels(own, priya)).toEqual(['Start work', 'Mark done', 'Cancel task']);
    expect(labels({ ...own, status: 'COMPLETED' }, priya)).toEqual(['Not done yet']);
  });
  it('assigner can cancel and restore', () => {
    expect(labels(base({ status: 'CANCELLED', reviewer: rahul, createdBy: rahul }), rahul)).toEqual(['Restore']);
  });
  it('admin sees everything for an open task', () => {
    expect(labels(base({ createdBy: rahul, reviewer: rahul, status: 'IN_PROGRESS' }), admin, true))
      .toEqual(['Mark done', 'Cancel task']);
  });
  it('workflow step: mark done passes to next step', () => {
    const step = base({ createdBy: admin, reviewer: null, workflow: { step: 1, total: 3, name: 'Cycle' } });
    expect(labels(step, priya)).toContain('Mark done & start next step');
    expect(labels({ ...step, workflow: { step: 3, total: 3 } }, priya)).toContain('Mark done');
    expect(labels(step, priya)).not.toContain('Cancel task');
  });
});

describe('yourTurn: one line about what to do', () => {
  it('assignee is told who reviews', () => {
    expect(yourTurn(base(), priya)).toBe('Your task. When finished, submit it to System Admin for review.');
  });
  it('reviewer is told to approve', () => {
    expect(yourTurn(base({ status: 'SUBMITTED' }), admin)).toMatch(/Priya Sharma has submitted this/);
  });
  it('workflow step tells who is next', () => {
    const run = { steps: [{}, { assignee: rahul }] };
    const t = base({ reviewer: null, workflow: { step: 1, total: 2, name: 'Cycle' } });
    expect(yourTurn(t, priya, run)).toMatch(/step 2 goes to Rahul Patil/);
  });
});
