import { http, qs } from './http.js';

export const notificationService = {
  list: (limit) => http('/api/notifications' + qs({ limit })),
  unreadCount: () => http('/api/notifications/unread-count'),
  markRead: (id) => http(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => http('/api/notifications/read-all', { method: 'POST' }),
};
