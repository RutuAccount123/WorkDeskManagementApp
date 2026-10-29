import { http, tokenStore } from './http.js';

export const authService = {
  login: (email, password) => http('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => http('/api/auth/me'),
  /** The real backend signs out every other device and sends a fresh token for this one. */
  changePassword: async (currentPassword, newPassword) => {
    const res = await http('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    if (res?.token) tokenStore.set(res.token);
    return res;
  },
};
