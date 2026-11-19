import { http, qs } from './http.js';

/** Personal leave. Admins add / remove; everyone sees their own. Dates are "yyyy-mm-dd", both included. */
export const leaveService = {
  /** filters: { employeeId (admins), from, to } */
  list: (filters = {}) => http('/api/leaves' + qs(filters)),
  create: (data) => http('/api/leaves', { method: 'POST', body: data }),
  /** Admins only. */
  update: (id, data) => http(`/api/leaves/${id}`, { method: 'PUT', body: data }),
  /** Admins only. */
  remove: (id) => http(`/api/leaves/${id}`, { method: 'DELETE' }),
  /** The person on leave asks an admin to change or remove it. */
  raiseTicket: (id, assignedToId, note) => http(`/api/leaves/${id}/tickets`, { method: 'POST', body: { assignedToId, note } }),
};
