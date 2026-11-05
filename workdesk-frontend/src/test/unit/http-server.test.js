// The same http helper, switched to the real Spring Boot backend (VITE_USE_MOCK=false).
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env.js', () => ({ USE_MOCK: false, API_URL: 'https://api.example.com', APP_NAME: 'Work Desk' }));
const { http, tokenStore, setUnauthorizedHandler } = await import('@/services/http.js');
const { taskService, reportService } = await import('@/services/index.js');

const json = (status, data) => new Response(data == null ? null : JSON.stringify(data), {
  status, headers: data == null ? {} : { 'Content-Type': 'application/json' },
});

afterEach(() => { vi.unstubAllGlobals(); tokenStore.clear(); });

describe('http against the real backend', () => {
  it('sends the token, JSON body and the API base URL', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { id: 7 }));
    vi.stubGlobal('fetch', fetch);
    tokenStore.set('abc');
    const out = await taskService.create({ title: 'Check GST' });
    expect(out).toEqual({ id: 7 });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/tasks');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ title: 'Check GST' });
  });
  it('builds list filters into the URL', async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, []));
    vi.stubGlobal('fetch', fetch);
    await taskService.list({ scope: 'review', status: ['SUBMITTED'], q: '' });
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.com/api/tasks?scope=review&status=SUBMITTED');
  });
  it('shows the server message on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { message: 'title: must not be blank' })));
    await expect(http('/api/tasks', { method: 'POST', body: {} })).rejects.toThrow('title: must not be blank');
  });
  it('preserves the server status on errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(405, { message: 'This action is not supported here' })));
    await expect(http('/api/tasks/batch', { method: 'POST', body: {} })).rejects.toMatchObject({
      message: 'This action is not supported here',
      status: 405,
    });
  });
  it('creates multi-assignee tasks individually if the backend lacks the batch endpoint', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(405, { message: 'This action is not supported here' }))
      .mockResolvedValueOnce(json(201, { id: 21, assignee: { id: 2 } }))
      .mockResolvedValueOnce(json(201, { id: 22, assignee: { id: 3 } }));
    vi.stubGlobal('fetch', fetch);

    const tasks = await taskService.createForAssignees([2, 3], { title: 'Shared work', reviewerId: 1 });

    expect(tasks.map((task) => task.assignee.id)).toEqual([2, 3]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.slice(1).map(([, request]) => JSON.parse(request.body))).toEqual([
      { title: 'Shared work', reviewerId: 1, assigneeId: 2 },
      { title: 'Shared work', reviewerId: 1, assigneeId: 3 },
    ]);
  });
  it('explains when single-task creation is also rejected after batch fallback', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(405, { message: 'This action is not supported here' }))
      .mockResolvedValueOnce(json(405, { message: 'This action is not supported here' }));
    vi.stubGlobal('fetch', fetch);

    await expect(taskService.createForAssignees([2, 3], { title: 'Shared work', reviewerId: 1 }))
      .rejects.toThrow('The backend rejected single-task creation (HTTP 405), so no tasks were created');
  });
  it('approves selected tasks individually if the backend lacks the batch approval endpoint', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json(405, { message: 'This action is not supported here' }))
      .mockResolvedValueOnce(json(200, { id: 21, status: 'COMPLETED' }))
      .mockResolvedValueOnce(json(200, { id: 22, status: 'COMPLETED' }));
    vi.stubGlobal('fetch', fetch);

    const approved = await taskService.approveMany([21, 22]);

    expect(approved.map((task) => task.status)).toEqual(['COMPLETED', 'COMPLETED']);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.slice(1).map(([url, request]) => [url, JSON.parse(request.body)])).toEqual([
      ['https://api.example.com/api/tasks/21/status', { status: 'COMPLETED' }],
      ['https://api.example.com/api/tasks/22/status', { status: 'COMPLETED' }],
    ]);
  });
  it('falls back to the status code when the error has no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })));
    await expect(http('/api/tasks')).rejects.toThrow('Request failed (500)');
  });
  it('gives a friendly message when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(http('/api/tasks')).rejects.toThrow('Cannot reach the server');
  });
  it('signs the person out on 401 (but not on a wrong login)', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { message: 'Invalid email or password' })));
    await expect(http('/api/auth/login', { method: 'POST', body: {} })).rejects.toThrow('Invalid email or password');
    expect(handler).not.toHaveBeenCalled();
    await expect(http('/api/tasks')).rejects.toThrow('Your session has ended');
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('returns null on 204 and the raw response for CSV', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(204, null))
      .mockResolvedValueOnce(new Response('a,b', { status: 200, headers: { 'Content-Type': 'text/csv' } })));
    expect(await http('/api/notifications/read-all', { method: 'POST' })).toBeNull();
    const res = await reportService.employeeSummaryCsv({ from: '2026-10-01', to: '2026-10-27' });
    expect(await res.text()).toBe('a,b');
  });
});
