import { describe, expect, it, vi } from 'vitest';
import { http, qs, setUnauthorizedHandler, tokenStore } from '@/services/http.js';

describe('qs (query string builder)', () => {
  it('skips empty values and repeats arrays', () => {
    expect(qs({ a: 1, b: '', c: null, d: undefined, e: [] })).toBe('?a=1');
    expect(qs({ status: ['TODO', 'SUBMITTED'], q: 'gst bill' })).toBe('?status=TODO&status=SUBMITTED&q=gst+bill');
    expect(qs({})).toBe('');
  });
});

describe('http in demo (mock) mode', () => {
  it('turns an API error into a readable message', async () => {
    await expect(http('/api/auth/login', { method: 'POST', body: { email: 'x@y.z', password: 'nope' } }))
      .rejects.toThrow('Invalid email or password');
  });
  it('calls the sign-out handler on 401 and clears nothing else', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    tokenStore.clear();
    await expect(http('/api/tasks')).rejects.toThrow('Your session has ended');
    expect(handler).toHaveBeenCalledTimes(1);
    setUnauthorizedHandler(() => {});
  });
  it('returns null for 204 responses', async () => {
    const res = await http('/api/auth/login', { method: 'POST', body: { email: 'admin@company.com', password: 'Admin@123' } });
    tokenStore.set(res.token);
    expect(await http('/api/notifications/read-all', { method: 'POST' })).toBeNull();
  });
  it('returns the raw Response for file downloads', async () => {
    const res = await http('/api/auth/login', { method: 'POST', body: { email: 'admin@company.com', password: 'Admin@123' } });
    tokenStore.set(res.token);
    const file = await http('/api/reports/employees.csv?from=2026-10-01&to=2026-10-27', { raw: true });
    expect(file).toBeInstanceOf(Response);
    expect((await file.text()).split('\n')[0]).toMatch(/^Employee,Department,Assigned/);
  });
});
