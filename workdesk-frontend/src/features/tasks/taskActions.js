// Rules for what each person can do on a task, and the one-line "your turn" message.
// Shared by the task page; mirrors the server-side rules.

export const ACTION_TEXT = {
  CREATED: 'created the task',
  UPDATED: 'edited the task',
  REASSIGNED: 'reassigned the task',
  COMMENTED: 'commented',
  REMINDER_SENT: 'sent a reminder',
  AUTO_GENERATED: 'created this automatically',
};

/**
 * Which buttons to show, based on the viewer's part in the task:
 *   assignee → start / submit (or close it themselves when no review is needed)
 *   reviewer → approve / send back
 *   assigner → cancel / restore
 *   admin    → everything
 */
export function actionsFor(task, user, isAdmin) {
  const s = task.status;
  const mine = task.assignee.id === user.id;
  const isReviewer = task.reviewer?.id === user.id;
  const isAssigner = task.createdBy?.id === user.id;
  const noReview = !task.reviewer;
  const a = [];
  const add = (to, label, kind = 'ghost', extra = {}) => {
    if (!a.some((x) => x.to === to)) a.push({ to, label, kind, ...extra });
  };

  if (mine) {
    if (s === 'TODO' || s === 'REOPENED') add('IN_PROGRESS', 'Start work', noReview ? 'ghost' : 'primary');
    if (noReview) {
      if (['TODO', 'IN_PROGRESS', 'REOPENED'].includes(s)) {
        const last = task.workflow && task.workflow.step >= task.workflow.total;
        add('COMPLETED', task.workflow && !last ? 'Mark done & start next step' : 'Mark done', 'primary');
      }
      if (s === 'COMPLETED' && !task.workflow) add('IN_PROGRESS', 'Not done yet'); // a finished workflow step has already passed on
    } else if (s === 'IN_PROGRESS') {
      add('SUBMITTED', `Submit to ${isReviewer ? 'review' : task.reviewer.fullName.split(' ')[0]}`, 'primary');
    }
  }
  if (isReviewer || isAdmin) {
    if (s === 'SUBMITTED') {
      add('COMPLETED', 'Approve', 'primary');
      add('REOPENED', 'Send back', 'ghost', { needsComment: true });
    }
    if (s === 'COMPLETED' && !(mine && noReview)) add('REOPENED', 'Reopen', 'ghost', { needsComment: true });
  }
  if (isAdmin && ['TODO', 'IN_PROGRESS', 'REOPENED'].includes(s)) add('COMPLETED', 'Mark done');
  // Cancelling a workflow step stops the whole chain, so only its owner or an admin can do that.
  if (isAssigner || isAdmin || (mine && noReview && !task.workflow)) {
    if (['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'].includes(s)) add('CANCELLED', 'Cancel task', 'danger-ghost');
    if (s === 'CANCELLED') add('TODO', 'Restore');
  }
  return a;
}

/** One line telling the viewer what is expected of them right now. */
export function yourTurn(task, user, run) {
  const s = task.status;
  if (task.workflow && task.assignee.id === user.id && ['TODO', 'IN_PROGRESS'].includes(s)) {
    const next = run?.steps[task.workflow.step];
    return next
      ? `Step ${task.workflow.step} of ${task.workflow.total} in “${task.workflow.name}”. When you mark it done, step ${task.workflow.step + 1} goes to ${next.assignee.id === user.id ? 'you' : next.assignee.fullName}.`
      : `Last step of “${task.workflow.name}”. Marking it done completes today’s workflow.`;
  }
  if (task.assignee.id === user.id && ['TODO', 'IN_PROGRESS', 'REOPENED'].includes(s)) {
    return task.reviewer ? `Your task. When finished, submit it to ${task.reviewer.id === user.id ? 'yourself' : task.reviewer.fullName} for review.` : 'Your task. Mark it done when finished.';
  }
  if (task.reviewer?.id === user.id && s === 'SUBMITTED') return `${task.assignee.fullName} has submitted this. Please approve it or send it back.`;
  if (task.createdBy?.id === user.id && task.assignee.id !== user.id) return `You assigned this to ${task.assignee.fullName}.`;
  return null;
}
