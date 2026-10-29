import { http, qs } from './http.js';

/** FMS-style workflows: steps that run one after another, every day or week. */
export const workflowService = {
  /** All FMS you can see; pass taskId to get the ones linked to that task. */
  list: (taskId) => http('/api/workflows' + qs({ taskId })),
  get: (id) => http(`/api/workflows/${id}`),
  create: (data) => http('/api/workflows', { method: 'POST', body: data }),
  update: (id, data) => http(`/api/workflows/${id}`, { method: 'PUT', body: data }),
  setActive: (id, active) => http(`/api/workflows/${id}/active?value=${active}`, { method: 'PATCH' }),
  remove: (id) => http(`/api/workflows/${id}`, { method: 'DELETE' }),
  /** Starts a new run now with the form filled in. Can be done several times a day. */
  startNow: (id, formData, sourceTaskId) => http(`/api/workflows/${id}/start-now`, { method: 'POST', body: { formData, sourceTaskId } }),
  /** Fills the form of a scheduled run; this starts step 1. */
  fillForm: (runId, formData) => http(`/api/workflows/runs/${runId}/form`, { method: 'POST', body: { formData } }),
  /** Runs (one per workflow per day) with each step's task. date: yyyy-mm-dd, default today. */
  runs: (date) => http('/api/workflows/runs' + qs({ date })),
  run: (runId) => http(`/api/workflows/runs/${runId}`),
  /** Runs started for a task (FMS linked to that task). */
  runsForTask: (taskId) => http('/api/workflows/runs' + qs({ taskId })),
  /** Tracker rows of one FMS between two dates (yyyy-mm-dd), newest first. */
  tracker: (id, from, to) => http(`/api/workflows/${id}/runs` + qs({ from, to })),
};
