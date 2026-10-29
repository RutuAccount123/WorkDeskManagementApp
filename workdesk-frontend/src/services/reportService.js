import { http, qs } from './http.js';

export const reportService = {
  dashboard: () => http('/api/reports/dashboard'),
  team: (period = 'today') => http('/api/reports/team' + qs({ period })),
  performance: ({ employeeId, month } = {}) => http('/api/reports/performance' + qs({ employeeId, month })),
  yearly: ({ employeeId, year } = {}) => http('/api/reports/yearly' + qs({ employeeId, year })),
  employeeSummary: ({ from, to }) => http('/api/reports/employees' + qs({ from, to })),
  employeeSummaryCsv: ({ from, to }) => http('/api/reports/employees.csv' + qs({ from, to }), { raw: true }),
  daily: ({ from, to, employeeId }) => http('/api/reports/daily' + qs({ from, to, employeeId })),
};
