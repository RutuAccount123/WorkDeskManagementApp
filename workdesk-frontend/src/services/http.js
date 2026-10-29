// Small fetch wrapper: adds the login token, parses JSON, and turns errors into readable messages.
//
// MOCK MODE (default): VITE_USE_MOCK=true in .env → no backend needed, dummy data from src/mock/.
// REAL BACKEND:        VITE_USE_MOCK=false        → calls the Spring Boot API.
// Components never call this directly — they use the services in src/services/.

import { mockFetch } from '@/mock/mockServer.js';
import { API_URL, USE_MOCK } from '@/config/env.js';

const BASE = API_URL; // empty = same origin (dev proxy / same domain in prod)
const TOKEN_KEY = 'ewms_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export async function http(path, { method = 'GET', body, raw = false } = {}) {
  const token = tokenStore.get();
  const res = USE_MOCK ? await callMock(path, method, body, token) : await callServer(path, method, body, token);

  if (res.status === 401 && !path.startsWith('/api/auth/login')) {
    onUnauthorized();
    throw new Error('Your session has ended. Please sign in again.');
  }
  if (res.status >= 400) {
    throw new Error(res.data?.message || `Request failed (${res.status})`);
  }
  if (raw) return res.data instanceof Response ? res.data : res.response;
  if (res.status === 204) return null;
  return res.data;
}

async function callMock(path, method, body, token) {
  return mockFetch(method, path, body, token);
}

async function callServer(path, method, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }
  let data = null;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (isJson && response.status !== 204) {
    try { data = await response.json(); } catch { /* empty body */ }
  }
  return { status: response.status, data, response };
}

/** Builds a query string, skipping empty values. Arrays become repeated params. */
export function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
    else p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}
