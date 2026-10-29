import { http, qs } from './http.js';

/** Office holidays. params: { year } or { from, to } (yyyy-mm-dd). */
export const holidayService = {
  list: (params = {}) => http('/api/holidays' + qs(params)),
  create: (data) => http('/api/holidays', { method: 'POST', body: data }),
  update: (id, data) => http(`/api/holidays/${id}`, { method: 'PUT', body: data }),
  remove: (id) => http(`/api/holidays/${id}`, { method: 'DELETE' }),
};
