import { tokenStore } from '@/services/http.js';
import { authService } from '@/services/index.js';

/** Signs in through the real login service and keeps the token, like the app does. */
export async function signIn(email, password = email.startsWith('admin') ? 'Admin@123' : 'Employee@123') {
  const res = await authService.login(email, password);
  tokenStore.set(res.token);
  return res.user;
}

export const ADMIN = 'admin@company.com';
export const PRIYA = 'priya@company.com';   // id 2, Accounts
export const RAHUL = 'rahul@company.com';   // id 3, Purchase
export const SNEHA = 'sneha@company.com';   // id 4, Projects
export const AMIT = 'amit@company.com';     // id 5, Projects

/** yyyy-mm-ddThh:mm for a date n days from now at 18:00 local. */
export function localDue(daysFromNow = 1, hhmm = '18:00') {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${z.toISOString().slice(0, 10)}T${hhmm}`;
}
