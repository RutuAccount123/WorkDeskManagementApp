import { http, qs } from './http.js';

export const taskService = {
  /**
   * filters: { scope, status[], assigneeId, priority, overdue, q, workFrom, workTo }
   * scope: 'assigned' (to me) | 'created' (I assigned to others) | 'review' (I am the reviewer) | 'all' (admin)
   */
  list: (filters = {}) => http('/api/tasks' + qs(filters)),
  get: (id) => http(`/api/tasks/${id}`),
  activity: (id) => http(`/api/tasks/${id}/activity`),
  approveMany: async (taskIds) => {
    try {
      return await http('/api/tasks/batch/approve', { method: 'POST', body: { taskIds } });
    } catch (error) {
      if (error.status !== 405) throw error;

      const approved = [];
      for (const taskId of taskIds) {
        try {
          approved.push(await http(`/api/tasks/${taskId}/status`, {
            method: 'POST',
            body: { status: 'COMPLETED' },
          }));
        } catch (fallbackError) {
          if (!approved.length) throw fallbackError;
          const partialError = new Error(
            `Approved ${approved.length} of ${taskIds.length} tasks. The next approval failed: ${fallbackError.message}`,
          );
          partialError.status = fallbackError.status;
          throw partialError;
        }
      }
      return approved;
    }
  },
  create: (data) => http('/api/tasks', { method: 'POST', body: data }),
  createForAssignees: async (assigneeIds, data) => {
    try {
      return await http('/api/tasks/batch', { method: 'POST', body: { assigneeIds, task: data } });
    } catch (error) {
      if (error.status !== 405) throw error;

      const created = [];
      for (const assigneeId of assigneeIds) {
        try {
          created.push(await http('/api/tasks', {
            method: 'POST',
            body: { ...data, assigneeId },
          }));
        } catch (fallbackError) {
          if (!created.length && fallbackError.status === 405) {
            throw new Error('The backend rejected single-task creation (HTTP 405), so no tasks were created. Check that the local backend is running the latest code and that API routing is configured correctly.');
          }
          if (!created.length) throw fallbackError;
          const partialError = new Error(
            `Created ${created.length} of ${assigneeIds.length} tasks. The next assignment failed: ${fallbackError.message}`,
          );
          partialError.status = fallbackError.status;
          throw partialError;
        }
      }
      return created;
    }
  },
  update: (id, data) => http(`/api/tasks/${id}`, { method: 'PUT', body: data }),
  remove: (id) => http(`/api/tasks/${id}`, { method: 'DELETE' }),
  changeStatus: (id, status, comment) => http(`/api/tasks/${id}/status`, { method: 'POST', body: { status, comment } }),
  /** Tick or untick one checklist item (index) on a workflow step. */
  tick: (id, index, done) => http(`/api/tasks/${id}/checklist`, { method: 'POST', body: { index, done } }),
  addComment: (id, comment) => http(`/api/tasks/${id}/comments`, { method: 'POST', body: { comment } }),
};
