import { isoDay } from '@/utils/format.js';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Project active FMS schedules into calendar-only entries for the selected week. */
export function scheduledFmsForWeek(workflows, tasks, from, holidays, employeeId, today = new Date()) {
  const actualRuns = new Set(
    tasks
      .filter((task) => task.workflow)
      .map((task) => `${task.workflow.name}|${task.workflow.date}`),
  );
  const entries = [];
  const todayKey = isoDay(today);

  for (const workflow of workflows) {
    if (!workflow.active || !['DAILY', 'WEEKLY'].includes(workflow.frequency)) continue;
    if (employeeId != null && workflow.steps?.[0]?.assignee?.id !== employeeId) continue;

    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
      const date = isoDay(day);
      const dayName = DAY_NAMES[day.getDay()];
      if (date < todayKey) continue;
      if (dayName === 'SUNDAY' || holidays[date]) continue;
      if (workflow.frequency === 'WEEKLY' && workflow.dayOfWeek !== dayName) continue;
      if (actualRuns.has(`${workflow.name}|${date}`)) continue;

      const [hours, minutes] = (workflow.startTime || '09:00').split(':').map(Number);
      day.setHours(hours, minutes, 0, 0);
      entries.push({
        id: `scheduled-fms-${workflow.id}-${date}`,
        title: workflow.name,
        status: 'TODO',
        dueAt: day.toISOString(),
        workflow: { id: workflow.id, name: workflow.name, date },
        scheduled: true,
      });
    }
  }

  return entries;
}
