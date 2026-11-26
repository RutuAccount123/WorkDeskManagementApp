import { http } from './http.js';

/**
 * Instruments tab: site instruments, who has them now, and their history. Open to everyone.
 * add: { name, weightKg, info, holderId?, location?, project?, note? } (with holderId it is given to them at once)
 * give: { holderId, location, project, note } gives a free one to a person, or shifts it to another person.
 */
export const instrumentService = {
  list: () => http('/api/instruments'),
  add: (data) => http('/api/instruments', { method: 'POST', body: data }),
  update: (id, data) => http(`/api/instruments/${id}`, { method: 'PUT', body: data }),
  history: (id) => http(`/api/instruments/${id}/history`),
  give: (id, data) => http(`/api/instruments/${id}/give`, { method: 'POST', body: data }),
  submit: (id, note) => http(`/api/instruments/${id}/submit`, { method: 'POST', body: { note: note || null } }),
  /** removed instruments (who removed them, when and why) */
  removed: () => http('/api/instruments?removed=true'),
  repairs: (id) => http(`/api/instruments/${id}/repairs`),
  /** { problem, repairShop, expectedBack?, estimatedCost?, note? } */
  repair: (id, data) => http(`/api/instruments/${id}/repair`, { method: 'POST', body: data }),
  /** { repairCost?, note? } back from repair: free in the office store */
  repairDone: (id, data) => http(`/api/instruments/${id}/repair/done`, { method: 'POST', body: data || {} }),
  remove: (id, reason) => http(`/api/instruments/${id}/remove`, { method: 'POST', body: { reason } }),
};
