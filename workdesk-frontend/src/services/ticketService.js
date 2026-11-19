import { http, qs } from './http.js';

/** Tickets: ask another person for help on a task, with a note. They reply and resolve it. */
export const ticketService = {
  /** scope: 'assigned' (to me, default) | 'raised' (by me) | 'all' (admin); status: 'OPEN' | 'RESOLVED' */
  list: (filters = {}) => http('/api/tickets' + qs(filters)),
  forTask: (taskId) => http(`/api/tasks/${taskId}/tickets`),
  raise: (taskId, assignedToId, note) => http(`/api/tasks/${taskId}/tickets`, { method: 'POST', body: { assignedToId, note } }),
  /** Answer the ticket: it closes and the task goes back to its assignee. */
  resolve: (id, reply) => http(`/api/tickets/${id}/resolve`, { method: 'POST', body: { reply } }),
  /** Only the person the ticket is assigned to: finish the task yourself (it moves to you and is done). */
  markTaskDone: (id, reply) => http(`/api/tickets/${id}/done`, { method: 'POST', body: { reply } }),
};
