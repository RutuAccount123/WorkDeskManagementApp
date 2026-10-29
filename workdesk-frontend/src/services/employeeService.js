import { http } from './http.js';

export const employeeService = {
  /** Active people anyone can assign work to (id, name, department). Available to every user. */
  directory: () => http('/api/people'),
  /** Full employee records. Admin only. */
  list: () => http('/api/employees'),
  get: (id) => http(`/api/employees/${id}`),
  create: (data) => http('/api/employees', { method: 'POST', body: data }),
  update: (id, data) => http(`/api/employees/${id}`, { method: 'PUT', body: data }),
  setActive: (id, active) => http(`/api/employees/${id}/active?value=${active}`, { method: 'PATCH' }),
  resetPassword: (id, newPassword) => http(`/api/employees/${id}/reset-password`, { method: 'POST', body: { newPassword } }),
};
