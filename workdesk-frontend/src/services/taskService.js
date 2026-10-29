import { http, qs } from './http.js';

export const taskService = {
  /**
   * filters: { scope, status[], assigneeId, priority, overdue, q, workFrom, workTo }
   * scope: 'assigned' (to me) | 'created' (I assigned to others) | 'review' (I am the reviewer) | 'all' (admin)
   */
  list: (filters = {}) => http('/api/tasks' + qs(filters)),
  get: (id) => http(`/api/tasks/${id}`),
  activity: (id) => http(`/api/tasks/${id}/activity`),
  create: (data) => http('/api/tasks', { method: 'POST', body: data }),
  update: (id, data) => http(`/api/tasks/${id}`, { method: 'PUT', body: data }),
  remove: (id) => http(`/api/tasks/${id}`, { method: 'DELETE' }),
  changeStatus: (id, status, comment) => http(`/api/tasks/${id}/status`, { method: 'POST', body: { status, comment } }),
  /** Tick or untick one checklist item (index) on a workflow step. */
  tick: (id, index, done) => http(`/api/tasks/${id}/checklist`, { method: 'POST', body: { index, done } }),
  addComment: (id, comment) => http(`/api/tasks/${id}/comments`, { method: 'POST', body: { comment } }),
};
