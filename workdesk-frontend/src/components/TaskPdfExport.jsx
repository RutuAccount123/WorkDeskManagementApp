import { useState } from 'react';
import { taskService } from '@/services/index.js';
import { STATUS_LABEL, PRIORITY_LABEL, addDays, fmtDateTime, fmtDayLong, fmtMonth, fmtMonthShort, isoDay, startOfDay, startOfMonth, startOfWeek, workDate } from '@/utils/format.js';
import { groupFmsTasks } from '@/features/tasks/taskGroups.js';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function rangeFor(view, anchor) {
  if (view === 'day') {
    const from = startOfDay(anchor);
    return [from, addDays(from, 1)];
  }
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return [from, addDays(from, 7)];
  }
  if (view === 'month') {
    const from = startOfMonth(anchor);
    return [from, new Date(from.getFullYear(), from.getMonth() + 1, 1)];
  }
  return [new Date(anchor.getFullYear(), 0, 1), new Date(anchor.getFullYear() + 1, 0, 1)];
}

function titleFor(view, anchor) {
  if (view === 'day') return isoDay(anchor) === isoDay(new Date()) ? `Today’s work · ${fmtDayLong(anchor)}` : fmtDayLong(anchor);
  if (view === 'week') {
    const [from, to] = rangeFor(view, anchor);
    const last = addDays(to, -1);
    return `Work for ${from.getDate()} ${fmtMonthShort(from)} – ${last.getDate()} ${fmtMonthShort(last)} ${last.getFullYear()}`;
  }
  if (view === 'month') return `Work for ${fmtMonth(anchor)}`;
  return `Work for ${anchor.getFullYear()}`;
}

export default function TaskPdfExport({ employeeId, employeeName, user, view, anchor }) {
  const [error, setError] = useState('');

  const exportPdf = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to export the PDF.');
      return;
    }

    setError('');
    printWindow.document.write('<!doctype html><title>Preparing PDF…</title><p>Preparing your PDF…</p>');
    const [from, to] = rangeFor(view, anchor);
    try {
      const tasks = groupFmsTasks(await taskService.list({
        assigneeId: employeeId,
        workFrom: isoDay(from),
        workTo: isoDay(addDays(to, -1)),
      })).sort((a, b) => workDate(a) - workDate(b));
      const title = titleFor(view, anchor);
      const subject = employeeName || tasks[0]?.assignee?.fullName || user?.fullName || 'All employees';
      const allEmployees = user?.role === 'ADMIN' && employeeId == null;
      const rows = tasks.map((task) => `
        <tr>
          <td>${escape(task.title)}</td>
          <td>${escape(STATUS_LABEL[task.status] || task.status)}</td>
          <td>${escape(PRIORITY_LABEL[task.priority] || task.priority)}</td>
          <td>${escape(task.scheduledAt ? fmtDateTime(task.scheduledAt) : '—')}</td>
          <td>${escape(task.dueAt ? fmtDateTime(task.dueAt) : '—')}</td>
          ${allEmployees ? `<td>${escape(task.assignee?.fullName || '—')}</td>` : ''}
        </tr>`).join('');
      const range = `${isoDay(from)} – ${isoDay(addDays(to, -1))}`;
      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
        <html><head><meta charset="utf-8"><title>${escape(title)} - ${escape(subject)}</title>
        <style>
          body{font:14px Arial,sans-serif;color:#172033;margin:32px}
          h1{font-size:24px;margin:0 0 6px}p{color:#5d687b;margin:4px 0 18px}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th,td{border:1px solid #d8deea;padding:9px;text-align:left;vertical-align:top}
          th{background:#f1f4fa}tr{break-inside:avoid}
          @media print{body{margin:14mm}thead{display:table-header-group}}
        </style></head><body>
        <h1>${escape(title)}</h1>
        <p>${escape(subject)} · ${escape(range)} · Generated ${escape(new Date().toLocaleString())}</p>
        <p>${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${tasks.filter((task) => task.status === 'COMPLETED').length} done · ${tasks.filter((task) => task.overdue).length} overdue</p>
        <table><thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Scheduled start</th><th>Due</th>${allEmployees ? '<th>Employee</th>' : ''}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${allEmployees ? 6 : 5}">No tasks in this period.</td></tr>`}</tbody>
        </table></body></html>`);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 300);
    } catch (exportError) {
      printWindow.close();
      setError(`Could not export PDF: ${exportError.message}`);
    }
  };

  return (
    <div className="task-pdf-export">
      <button type="button" className="btn ghost small" onClick={exportPdf}>Export PDF</button>
      {error && <span className="error small" role="alert">{error}</span>}
    </div>
  );
}
