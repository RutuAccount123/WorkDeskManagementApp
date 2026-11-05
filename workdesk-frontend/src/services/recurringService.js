import { http } from './http.js';

/** Daily / weekly repeating tasks. */
export const recurringService = {
  list: () => http('/api/recurring'),
  create: (data) => http('/api/recurring', { method: 'POST', body: data }),
  createForAssignees: (assigneeIds, data) =>
    http('/api/recurring/batch', { method: 'POST', body: { assigneeIds, task: data } }),
  update: (id, data) => http(`/api/recurring/${id}`, { method: 'PUT', body: data }),
  setActive: (id, active) => http(`/api/recurring/${id}/active?value=${active}`, { method: 'PATCH' }),
  remove: (id) => http(`/api/recurring/${id}`, { method: 'DELETE' }),
  generateNow: (id) => http(`/api/recurring/${id}/generate-now`, { method: 'POST' }),
};
