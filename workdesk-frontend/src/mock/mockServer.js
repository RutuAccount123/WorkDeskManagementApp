// ============================================================
//  FAKE BACKEND that runs inside the browser.
//  It answers the same URLs, with the same JSON, as the real
//  Spring Boot API — so pages don't know the difference.
//  Changes are saved in localStorage; "Reset demo data" on the
//  Account page puts everything back.
// ============================================================

import { buildSeed } from './data.js';

const STORE_KEY = 'ewms_mock_db_v7';
const AHEAD_DAYS = 7; // repeating tasks are created this many days ahead so they show in Week / Month views
const OPEN = ['TODO', 'IN_PROGRESS', 'SUBMITTED', 'REOPENED'];

// Same workflow rules as backend TaskStatus.java
const ASSIGNEE_MOVES = { TODO: ['IN_PROGRESS'], REOPENED: ['IN_PROGRESS'], IN_PROGRESS: ['SUBMITTED'] };
// Work an employee added for themselves: they can move it freely and close it without review.
const SELF_MOVES = {
  TODO: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'COMPLETED', 'CANCELLED'],
  REOPENED: ['IN_PROGRESS', 'COMPLETED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELLED: ['TODO'],
};
// The person chosen to review a task: approve it, or send it back.
const REVIEWER_MOVES = { SUBMITTED: ['COMPLETED', 'REOPENED'], COMPLETED: ['REOPENED'] };
// The person who assigned a task can cancel it or bring it back.
const CREATOR_MOVES = {
  TODO: ['CANCELLED'], IN_PROGRESS: ['CANCELLED'], SUBMITTED: ['CANCELLED'], REOPENED: ['CANCELLED'], CANCELLED: ['TODO'],
};
const ADMIN_MOVES = {
  TODO: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['TODO', 'SUBMITTED', 'COMPLETED', 'CANCELLED'],
  SUBMITTED: ['COMPLETED', 'REOPENED', 'CANCELLED'],
  REOPENED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['REOPENED'],
  CANCELLED: ['TODO'],
};

// ---------------------------------------------------------- storage

let db = load();

function load() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return buildSeed();
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* ignore */ }
}
export function resetMockData() {
  db = buildSeed();
  save();
}

const nextId = (list) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------- errors

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => new HttpError(400, m);
const notFound = (what) => new HttpError(404, `${what} not found`);
const forbidden = (m = 'You do not have permission to do this') => new HttpError(403, m);
function parseEstimatedHours(value) {
  if (value == null || value === '') return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) throw bad('Estimated hours must be between 0.25 and 24');
  return hours;
}

// ---------------------------------------------------------- shaping (same JSON as the real API)

const empById = (id) => db.employees.find((e) => e.id === id);
const empRef = (id) => { const e = empById(id); return e ? { id: e.id, fullName: e.fullName, department: e.department } : null; };
const empOut = ({ password, profilePhoto, ...e }) => e; // never send credentials or photo data

/**
 * Who reviews a task. The reviewer chosen when it was assigned; if none was chosen,
 * whoever assigned it (when that is someone else). null = no review needed (own work).
 */
const reviewerOf = (t) => (t.workflowRunId ? null : t.reviewerId ?? (t.createdById !== t.assigneeId ? t.createdById : null));
/** People involved in a task can open it: assignee, assigner, reviewer. Admins can open everything. */
const involved = (t, me) => [t.assigneeId, t.createdById, reviewerOf(t)].includes(me.id);

function isOverdue(t) {
  return OPEN.includes(t.status) && t.dueAt && new Date(t.dueAt) < new Date()
    && (t.estimatedHours == null || t.startedAt != null);
}
function taskOut(t) {
  return {
    id: t.id, title: t.title, description: t.description,
    assignee: empRef(t.assigneeId), createdBy: empRef(t.createdById),
    priority: t.priority, status: t.status, dueAt: t.dueAt, estimatedHours: t.estimatedHours ?? null, overdue: !!isOverdue(t),
    recurring: t.recurringTemplateId != null,
    repeat: t.recurringTemplateId != null ? (db.recurring.find((r) => r.id === t.recurringTemplateId)?.frequency || null) : null,
    linkedWorkflowId: t.workflowId || null,
    selfAdded: t.createdById === t.assigneeId,
    reviewer: empRef(reviewerOf(t)),
    workflow: t.workflowRunId ? workflowInfo(t) : null,
    checklist: t.checklist || [],
    createdAt: t.createdAt, updatedAt: t.updatedAt, startedAt: t.startedAt,
    submittedAt: t.submittedAt, completedAt: t.completedAt,
  };
}
function activityOut(a) {
  return {
    id: a.id, action: a.action, actorName: a.actorId ? empById(a.actorId)?.fullName : 'System',
    fromStatus: a.fromStatus, toStatus: a.toStatus, comment: a.comment, createdAt: a.createdAt,
  };
}
function templateOut(t) {
  return {
    id: t.id, title: t.title, description: t.description, assignee: empRef(t.assigneeId),
    priority: t.priority, frequency: t.frequency, dayOfWeek: t.dayOfWeek, dueTime: t.dueTime,
    estimatedHours: t.estimatedHours ?? null,
    active: t.active, lastGeneratedOn: t.lastGeneratedOn, createdAt: t.createdAt,
    createdBy: empRef(t.createdById), selfOwned: t.createdById === t.assigneeId,
    workflowId: t.workflowId || null,
  };
}

// ---------------------------------------------------------- helpers

function log(taskId, actorId, action, fromStatus, toStatus, comment) {
  const a = { id: nextId(db.activity), taskId, actorId, action, fromStatus, toStatus, comment: comment || null, createdAt: nowIso() };
  db.activity.push(a);
  return a;
}
function notify(recipientId, taskId, type, message) {
  const r = empById(recipientId);
  if (!r || !r.active) return;
  db.notifications.push({ id: nextId(db.notifications), recipientId, taskId, type, message, read: false, createdAt: nowIso() });
}
function getTask(id, me) {
  const t = db.tasks.find((x) => x.id === id);
  if (!t || (me.role !== 'ADMIN' && !involved(t, me))) throw notFound('Task');
  return t;
}
/** Validates the chosen reviewer. Empty → fallback. A person cannot review their own task. */
function pickReviewer(value, assigneeId, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const r = empById(Number(value));
  if (!r || !r.active) throw bad('Choose an active person as reviewer');
  if (r.id === assigneeId) throw bad('The person doing the task cannot also review it');
  return r.id;
}
function activeAssignee(id) {
  const e = empById(Number(id));
  if (!e) throw notFound('Employee');
  if (!e.active) throw bad(`${e.fullName} is inactive and cannot be assigned work`);
  return e;
}
// "2026-10-30T18:00" (local) -> ISO
const localToIso = (v) => (v ? new Date(v).toISOString() : null);
const dayStart = (yyyyMmDd) => new Date(`${yyyyMmDd}T00:00`);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const between = (iso, a, b) => iso && new Date(iso) >= a && new Date(iso) < b;
const localDay = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const onTime = (t) => !t.dueAt || new Date(t.completedAt) <= new Date(t.dueAt);
const round1 = (v) => Math.round(v * 10) / 10;

/** The day a piece of work "belongs" to: its due date, or the day it was added if it has none. */
const workDate = (t) => t.dueAt || t.createdAt;
const monthKey = (d) => localDay(d).slice(0, 7); // "2026-10"
const monthRange = (key) => {
  const [y, m] = key.split('-').map(Number);
  return [new Date(y, m - 1, 1), new Date(y, m, 1)];
};

/**
 * Performance for one employee over a period.
 *   completion rate = done ÷ all work in the period (cancelled excluded)
 *   on-time rate    = done by the due time ÷ done
 *   score           = 60% completion + 40% on-time, out of 100
 */
function performance(empId, from, to) {
  // Count work that was due by now; future work only counts once it's finished early.
  const cutoff = new Date(Math.min(to.getTime(), Date.now()));
  const list = db.tasks.filter((t) => t.assigneeId === empId && t.status !== 'CANCELLED'
    && (between(workDate(t), from, cutoff) || (t.status === 'COMPLETED' && between(workDate(t), from, to))));
  const done = list.filter((t) => t.status === 'COMPLETED');
  const ok = done.filter(onTime).length;
  const open = list.filter((t) => OPEN.includes(t.status));
  const hours = done.map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / 3600e3).filter((h) => h >= 0);
  const completionRate = list.length ? done.length / list.length : null;
  const onTimeRate = done.length ? ok / done.length : null;
  const score = list.length ? Math.round(100 * (0.6 * completionRate + 0.4 * (onTimeRate ?? 0))) : null;
  return {
    total: list.length, completed: done.length, completedOnTime: ok, completedLate: done.length - ok,
    open: open.length, overdue: open.filter(isOverdue).length,
    selfAdded: list.filter((t) => t.createdById === empId).length,
    completionRate: completionRate == null ? null : round1(100 * completionRate),
    onTimeRate: onTimeRate == null ? null : round1(100 * onTimeRate),
    score, rating: rating(score),
    avgCompletionHours: hours.length ? round1(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
  };
}
function rating(score) {
  if (score == null) return 'No work yet';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs attention';
  return 'Poor';
}

/** Today's work for one person, split by status. */
function todayCounts(empId) {
  const start = dayStart(localDay(new Date()));
  const end = addDays(start, 1);
  const list = db.tasks.filter((t) => t.assigneeId === empId && t.status !== 'CANCELLED' && between(workDate(t), start, end));
  return {
    total: list.length,
    todo: list.filter((t) => t.status === 'TODO' || t.status === 'REOPENED').length,
    inProgress: list.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED').length,
    done: list.filter((t) => t.status === 'COMPLETED').length,
  };
}

/**
 * Imitates the backend's reminder jobs, once per task:
 *  - "due soon" for open work due in the next 24 hours
 *  - "overdue" to the employee and to the admin who assigned it
 */
function runDeadlineReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3600e3);
  let changed = false;
  db.tasks.forEach((t) => {
    if (!OPEN.includes(t.status) || !t.dueAt) return;
    const due = new Date(t.dueAt);
    if (due < now && !t.overdueReminded) {
      notify(t.assigneeId, t.id, 'OVERDUE', `Overdue: "${t.title}" was due ${due.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`);
      if (t.createdById !== t.assigneeId) notify(t.createdById, t.id, 'OVERDUE', `Overdue: "${t.title}" assigned to ${empById(t.assigneeId)?.fullName}`);
      t.overdueReminded = true; t.dueSoonReminded = true; changed = true;
    } else if (due >= now && due <= soon && !t.dueSoonReminded) {
      notify(t.assigneeId, t.id, 'DUE_SOON', `Reminder: "${t.title}" is due ${due.toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`);
      t.dueSoonReminded = true; changed = true;
    }
  });
  if (changed) save();
}

/** Once a day, each person gets a summary of their day as their first notification. */
function ensureDailyDigest(me) {
  const today = localDay(new Date());
  db.digests ||= {};
  if (db.digests[me.id] === today) return;
  let msg;
  if (me.role === 'ADMIN') {
    const open = db.tasks.filter((t) => OPEN.includes(t.status));
    const review = open.filter((t) => t.status === 'SUBMITTED').length;
    const late = open.filter(isOverdue).length;
    const dueToday = open.filter((t) => localDay(new Date(workDate(t))) === today).length;
    msg = `Today's summary for the team: ${dueToday} task${dueToday === 1 ? '' : 's'} due, ${late} overdue, ${review} waiting for your review.`;
  } else {
    const c = todayCounts(me.id);
    const late = db.tasks.filter((t) => t.assigneeId === me.id && isOverdue(t)).length;
    msg = c.total
      ? `Your work today: you have ${c.total} task${c.total === 1 ? '' : 's'}: ${c.todo} to do, ${c.inProgress} in progress, ${c.done} done.`
      : 'Nothing is scheduled for you today. Add the work you plan to do.';
    if (late) msg += ` ${late} overdue task${late === 1 ? ' needs' : 's need'} attention.`;
  }
  db.notifications.push({ id: nextId(db.notifications), recipientId: me.id, taskId: null, type: 'DAILY_DIGEST', message: msg, read: false, createdAt: nowIso() });
  db.digests[me.id] = today;
  save();
}

const WEEKDAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const holidayOn = (day) => (db.holidays || []).find((h) => h.date === day);

/** Does this repeating task fall on this date? Daily = Mon–Sat. Never on Sundays or office holidays. */
function templateRunsOn(tpl, day) {
  const d = new Date(`${day}T00:00`);
  if (holidayOn(day)) return false;
  if (tpl.frequency === 'DAILY') return d.getDay() !== 0;
  return WEEKDAY_NAMES[d.getDay()] === tpl.dayOfWeek;
}
const alreadyCreated = (tpl, day) =>
  db.tasks.some((t) => t.recurringTemplateId === tpl.id && t.dueAt && localDay(new Date(t.dueAt)) === day);

function createFromTemplate(tpl, day) {
  const due = new Date(`${day}T${tpl.dueTime.slice(0, 5)}`).toISOString();
  const t = {
    id: nextId(db.tasks), title: tpl.title, description: tpl.description,
    assigneeId: tpl.assigneeId, createdById: tpl.createdById, priority: tpl.priority, status: 'TODO',
    dueAt: due, createdAt: nowIso(), updatedAt: nowIso(), startedAt: null, submittedAt: null, completedAt: null,
    estimatedHours: tpl.estimatedHours ?? null,
    recurringTemplateId: tpl.id, dueSoonReminded: false, overdueReminded: false,
    workflowId: tpl.workflowId || null,
  };
  db.tasks.push(t);
  log(t.id, null, 'AUTO_GENERATED', null, 'TODO', tpl.frequency === 'DAILY' ? 'Daily task' : 'Weekly task');
  // Only today's copy is announced; future copies appear quietly in the calendar.
  if (day === localDay(new Date()) && tpl.createdById !== tpl.assigneeId) {
    notify(t.assigneeId, t.id, 'TASK_ASSIGNED', `New ${tpl.frequency.toLowerCase()} task: ${t.title}`);
  }
  if (!tpl.lastGeneratedOn || day > tpl.lastGeneratedOn) tpl.lastGeneratedOn = day;
  return t;
}

/** Imitates the backend scheduler: keep every active repeating task filled in for the next 7 days. */
function runRecurring() {
  const today = startOfLocalDay(new Date());
  let changed = false;
  db.recurring.forEach((tpl) => {
    if (!tpl.active || !empById(tpl.assigneeId)?.active) return;
    for (let i = 0; i < AHEAD_DAYS; i++) {
      const day = localDay(addDays(today, i));
      if (templateRunsOn(tpl, day) && !alreadyCreated(tpl, day)) { createFromTemplate(tpl, day); changed = true; }
    }
  });
  if (changed) save();
}
const startOfLocalDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** When a repeating task is paused, changed or deleted, remove its future copies nobody has started. */
function removeFutureCopies(tplId) {
  const tomorrow = addDays(startOfLocalDay(new Date()), 1);
  const gone = new Set(db.tasks.filter((t) => t.recurringTemplateId === tplId && t.status === 'TODO'
    && t.dueAt && new Date(t.dueAt) >= tomorrow).map((t) => t.id));
  db.tasks = db.tasks.filter((t) => !gone.has(t.id));
  db.activity = db.activity.filter((a) => !gone.has(a.taskId));
  db.notifications = db.notifications.filter((n) => !gone.has(n.taskId));
}


// =====================================================================
//  WORKFLOWS (FMS): a fixed sequence of steps that runs every day / week.
//  Only step 1 is assigned when the day starts. When a step is marked done,
//  the next step is assigned straight away to its person, due
//  "finish time + step hours" (but no later than the day's end time).
// =====================================================================
const at = (day, hhmm) => new Date(`${day}T${hhmm.slice(0, 5)}`);
const HOUR = 3600e3;

function workflowInfo(t) {
  const run = db.workflowRuns.find((r) => r.id === t.workflowRunId);
  const wf = run && db.workflows.find((w) => w.id === run.workflowId);
  return { runId: t.workflowRunId, name: run?.name || wf?.name || 'Workflow', step: t.workflowStep, total: run?.steps.length || t.workflowStep, date: run?.date, number: run?.number || 1, sourceTaskId: run?.sourceTaskId ?? null };
}

function workflowRunsOn(wf, day) {
  if (wf.frequency === 'ON_DEMAND') return false; // only started by hand or from its task
  const d = new Date(`${day}T00:00`);
  if (holidayOn(day) || d.getDay() === 0) return false;
  return wf.frequency === 'DAILY' || WEEKDAY_NAMES[d.getDay()] === wf.dayOfWeek;
}

/** Carries estimated effort through working-hour windows and skips Sundays and office holidays. */
function workDeadline(startedAt, estimatedHours, workStart = '10:00', workEnd = '18:00') {
  let remaining = Math.round(Number(estimatedHours) * 60);
  let cursor = new Date(startedAt);
  for (let searched = 0; searched < 36500; searched += 1) {
    const day = localDay(cursor);
    const opening = at(day, workStart);
    const closing = at(day, workEnd);
    const isWorkingDay = cursor.getDay() !== 0 && !holidayOn(day);
    if (isWorkingDay) {
      if (cursor < opening) cursor = opening;
      if (cursor < closing) {
        const available = Math.floor((closing - cursor) / 60000);
        if (remaining <= available) return new Date(cursor.getTime() + remaining * 60000);
        remaining -= available;
      }
    }
    cursor = at(localDay(addDays(at(day, '00:00'), 1)), workStart);
  }
  throw new Error('Could not find a working day for the task deadline');
}

function createStepTask(run, index, from) {
  const step = run.steps[index];
  const now = nowIso();
  const singleTaskRun = Array.isArray(run.progress);
  const firstTaskId = run.taskIds.find((id) => id != null);
  let t = singleTaskRun && firstTaskId ? db.tasks.find((x) => x.id === firstTaskId) : null;
  const created = !t;
  if (!t) {
    t = {
      id: nextId(db.tasks), createdAt: now, recurringTemplateId: null,
      dueSoonReminded: false, overdueReminded: false,
    };
    db.tasks.push(t);
  }
  Object.assign(t, {
    title: step.title, description: step.how || '',
    assigneeId: step.assigneeId, createdById: run.createdById, priority: step.priority || 'MEDIUM', status: 'TODO',
    dueAt: null, estimatedHours: step.hours, updatedAt: now,
    startedAt: null, submittedAt: null, completedAt: null,
    dueSoonReminded: false, overdueReminded: false,
    workflowRunId: run.id, workflowStep: index + 1,
    checklist: (step.checklist || []).map((text) => ({ text, done: false, doneAt: null })),
  });
  run.taskIds[index] = t.id;
  run.currentStep = index + 1;
  if (singleTaskRun) run.progress[index] = { status: 'TODO', dueAt: null, completedAt: null };
  log(t.id, null, created ? 'AUTO_GENERATED' : 'STATUS_CHANGED', created ? null : 'COMPLETED', 'TODO',
    `${run.name}: step ${index + 1} of ${run.steps.length}`
    + (index > 0 ? ` (started after step ${index} was completed)` : ''));
  const prev = index > 0 ? empById(run.steps[index - 1].assigneeId) : null;
  notify(step.assigneeId, t.id, 'WORKFLOW_STEP',
    index === 0 ? `${run.name}: step 1 "${t.title}" is yours today`
      : `${run.name}: ${prev?.fullName || 'previous step'} finished step ${index}. Step ${index + 1} "${t.title}" is now yours`);
  return t;
}

/**
 * Starts a run of a workflow: copies its steps and form (so later edits don't change it) and assigns step 1.
 * Scheduled runs start without form data: step 1's person fills the form first, then the work starts.
 * Manual runs ("Start new") come with the form already filled and can happen several times a day.
 */
function startRun(wf, day, { formData = null, by = null, manual = false, sourceTaskId = null } = {}) {
  if (formData) validateForm(wf.formFields || [], formData); // check before creating anything
  const sameDay = db.workflowRuns.filter((r) => r.workflowId === wf.id && r.date === day).length;
  const run = {
    id: nextId(db.workflowRuns), workflowId: wf.id, name: wf.name, date: day, createdById: wf.createdById,
    startTime: wf.startTime, endTime: wf.endTime, steps: wf.steps.map((st) => ({ ...st, checklist: [...(st.checklist || [])] })),
    formFields: (wf.formFields || []).map((f) => ({ ...f })), formData: null, formFilledBy: null, formFilledAt: null,
    number: sameDay + 1, manual, sourceTaskId: sourceTaskId ?? wf.sourceTaskId ?? null,
    taskIds: [], progress: wf.steps.map(() => ({ status: 'WAITING', dueAt: null, completedAt: null })),
    currentStep: 0, status: 'RUNNING', startedAt: nowIso(), finishedAt: null,
  };
  db.workflowRuns.push(run);
  const t = createStepTask(run, 0, manual ? new Date() : at(day, wf.startTime));
  if (formData) saveRunForm(run, formData, by, t);
  wf.lastRunOn = day;
  return run;
}

const needsForm = (run) => (run.formFields || []).length > 0 && !run.formData;

/** Checks a filled form against its fields. Returns the cleaned answers or throws a readable error. */
function validateForm(fields, data) {
  const clean = {};
  fields.forEach((f) => {
    let v = data?.[f.id];
    if (f.type === 'checkbox') v = !!v;
    else v = v == null ? '' : String(v).trim();
    if (f.required && (f.type === 'checkbox' ? false : v === '')) throw bad(`Please fill “${f.label}”`);
    if (f.type === 'number' && v !== '' && Number.isNaN(Number(v))) throw bad(`“${f.label}” must be a number`);
    if (f.type === 'select' && v !== '' && !f.options.includes(v)) throw bad(`Choose a valid option for “${f.label}”`);
    clean[f.id] = f.type === 'number' && v !== '' ? Number(v) : v;
  });
  return clean;
}

/** Stores the run's form. Filling it starts step 1. */
function saveRunForm(run, data, by, step1) {
  run.formData = validateForm(run.formFields, data);
  run.formFilledBy = by;
  run.formFilledAt = nowIso();
  const t = step1 || db.tasks.find((x) => x.id === run.taskIds[run.currentStep - 1]);
  if (t && t.status === 'TODO') {
    t.status = 'IN_PROGRESS';
    t.startedAt = nowIso();
    t.dueAt = workDeadline(t.startedAt, t.estimatedHours, run.startTime, run.endTime).toISOString();
    t.updatedAt = t.startedAt;
    if (run.progress) run.progress[run.currentStep - 1] = { ...run.progress[run.currentStep - 1], status: 'IN_PROGRESS', dueAt: t.dueAt };
    log(t.id, by, 'STATUS_CHANGED', 'TODO', 'IN_PROGRESS', 'Filled the workflow form. Work started.');
  }
}


/** Imitates the backend scheduler: start today's run for every active workflow that runs today. */
function runWorkflows() {
  const today = localDay(new Date());
  let changed = false;
  (db.workflows || []).forEach((wf) => {
    if (!wf.active || !workflowRunsOn(wf, today)) return;
    if (db.workflowRuns.some((r) => r.workflowId === wf.id && r.date === today)) return;
    if (wf.steps.some((st) => !empById(st.assigneeId)?.active)) return;
    startRun(wf, today);
    changed = true;
  });
  if (changed) save();
}

/** Called when a task's status changes. Completing a step triggers the next one. */
function onWorkflowTaskStatus(t, to) {
  if (!t.workflowRunId) return;
  const run = db.workflowRuns.find((r) => r.id === t.workflowRunId);
  if (!run) return;
  const index = t.workflowStep - 1;
  if (run.progress) {
    run.progress[index] = {
      ...run.progress[index],
      status: to,
      dueAt: t.dueAt,
      completedAt: to === 'COMPLETED' ? nowIso() : null,
    };
  }
  if (to === 'COMPLETED') {
    if (index + 1 < run.steps.length) {
      if (run.progress || !run.taskIds[index + 1]) createStepTask(run, index + 1, new Date());
    } else {
      run.status = 'DONE';
      run.finishedAt = nowIso();
      notify(run.createdById, t.id, 'WORKFLOW_DONE', `${run.name} (${run.date}): all ${run.steps.length} steps completed`);
      const src = run.sourceTaskId && db.tasks.find((x) => x.id === run.sourceTaskId);
      if (src) {
        log(src.id, null, 'COMMENTED', null, null, `FMS “${run.name}” finished: all ${run.steps.length} steps completed.`);
        [src.assigneeId, src.createdById].filter((x, i, a) => a.indexOf(x) === i && x !== run.createdById)
          .forEach((x) => notify(x, src.id, 'WORKFLOW_DONE', `FMS “${run.name}” for “${src.title}” is complete`));
      }
    }
  }
  if (to === 'CANCELLED') { run.status = 'STOPPED'; run.finishedAt = nowIso(); }
  if (['TODO', 'IN_PROGRESS', 'REOPENED'].includes(to) && ['STOPPED', 'DONE'].includes(run.status)) {
    run.status = 'RUNNING';
    run.finishedAt = null;
  }
}

function runOut(run) {
  const fields = run.formFields || [];
  const first = fields.find((f) => f.type !== 'checkbox' && run.formData?.[f.id] !== '' && run.formData?.[f.id] != null);
  return {
    id: run.id, workflowId: run.workflowId, name: run.name, date: run.date, status: run.status,
    number: run.number || 1, label: first ? String(run.formData[first.id]) : null,
    formFields: fields, formData: run.formData, needsForm: needsForm(run),
    formFilledBy: empRef(run.formFilledBy), formFilledAt: run.formFilledAt,
    startTime: run.startTime, endTime: run.endTime, startedAt: run.startedAt, finishedAt: run.finishedAt,
    currentStep: run.currentStep, totalSteps: run.steps.length,
    sourceTask: run.sourceTaskId ? taskRef(run.sourceTaskId) : null,
    steps: run.steps.map((st, i) => {
      const progress = run.progress?.[i];
      const isCurrent = run.currentStep === i + 1;
      const currentTask = isCurrent && run.taskIds[i] ? db.tasks.find((x) => x.id === run.taskIds[i]) : null;
      const legacyTask = !run.progress && run.taskIds[i] ? db.tasks.find((x) => x.id === run.taskIds[i]) : null;
      const task = run.progress
        ? progress?.status === 'WAITING' ? null : {
          id: currentTask?.id ?? null,
          status: currentTask?.status ?? progress?.status,
          dueAt: currentTask?.dueAt ?? progress?.dueAt,
          completedAt: currentTask?.completedAt ?? progress?.completedAt,
          overdue: currentTask ? !!isOverdue(currentTask)
            : ['TODO', 'IN_PROGRESS'].includes(progress?.status) && !!progress?.dueAt && new Date(progress.dueAt) < new Date(),
        }
        : legacyTask ? { id: legacyTask.id, status: legacyTask.status, dueAt: legacyTask.dueAt, completedAt: legacyTask.completedAt, overdue: !!isOverdue(legacyTask) } : null;
      const planned = progress?.dueAt ?? legacyTask?.dueAt ?? currentTask?.dueAt ?? null;
      const actual = progress?.completedAt ?? legacyTask?.completedAt ?? currentTask?.completedAt ?? null;
      return {
        step: i + 1, title: st.title, hours: st.hours, assignee: empRef(st.assigneeId), how: st.how || '', checklist: st.checklist || [],
        task: task || null,
        // FMS sheet columns: Planned, Actual, Time Delay (minutes; positive = late)
        planned,
        actual,
        delayMinutes: planned ? Math.round(((actual ? new Date(actual) : new Date()) - new Date(planned)) / 60000) : null,
      };
    }),
  };
}

const taskRef = (id) => { const t = db.tasks.find((x) => x.id === id); return t ? { id: t.id, title: t.title } : null; };

function workflowOut(wf) {
  return {
    sourceTask: wf.sourceTaskId ? taskRef(wf.sourceTaskId) : null,
    id: wf.id, name: wf.name, description: wf.description, frequency: wf.frequency, dayOfWeek: wf.dayOfWeek,
    startTime: wf.startTime, endTime: wf.endTime, active: wf.active, lastRunOn: wf.lastRunOn, createdAt: wf.createdAt,
    createdBy: empRef(wf.createdById),
    formFields: wf.formFields || [],
    steps: wf.steps.map((st, i) => ({
      step: i + 1, title: st.title, hours: st.hours, priority: st.priority, assignee: empRef(st.assigneeId),
      how: st.how || '', checklist: st.checklist || [],
    })),
    totalHours: wf.steps.reduce((sum, st) => sum + Number(st.hours), 0),
  };
}

// Demo only: past runs of "Daily purchase cycle" so the FMS tracker has rows (some on time, some late).
function demoHistory() {
  if (!db.demoWorkflowHistory) return;
  db.demoWorkflowHistory = false;
  const wf = db.workflows.find((w) => w.id === 1);
  if (!wf) return;
  const samples = [
    { f1: 'PIL', f2: 'Roofing sheets', f3: 40, f4: '', f5: false },
    { f1: 'Infosys SDB 7', f2: 'Vitrified tiles 600x600', f3: 85, f4: '', f5: false },
    { f1: 'AIGP Kharadi', f2: 'Sanitary fittings', f3: 24, f4: '', f5: true },
    { f1: 'Coca-Cola Pirangut', f2: 'Cement bags', f3: 200, f4: '', f5: false },
    { f1: 'PIL', f2: 'Gypsum boards', f3: 60, f4: '', f5: false },
  ];
  const lateBy = [[-40, -20, 35, -10], [-15, 80, -30, -5], [-50, -25, -20, -15], [20, 140, 60, 10], [-30, -10, -45, -20]];
  let back = 1, made = 0;
  while (made < samples.length && back < 15) {
    const day = localDay(addDays(new Date(), -back));
    back += 1;
    if (!workflowRunsOn(wf, day)) continue;
    const run = startRun(wf, day, { manual: false });
    run.formData = validateForm(run.formFields, samples[made]);
    run.formFilledBy = run.steps[0].assigneeId;
    run.formFilledAt = at(day, run.startTime).toISOString();
    run.startedAt = run.formFilledAt;
    let from = at(day, run.startTime);
    run.steps.forEach((st, i) => {
      const t = i === 0 ? db.tasks.find((x) => x.id === run.taskIds[0]) : createStepTask(run, i, from);
      t.dueAt = workDeadline(from, st.hours, run.startTime, run.endTime).toISOString();
      const done = new Date(new Date(t.dueAt).getTime() + lateBy[made][i] * 60000);
      (t.checklist || []).forEach((c) => { c.done = true; c.doneAt = done.toISOString(); });
      Object.assign(t, { status: 'COMPLETED', createdAt: from.toISOString(), startedAt: from.toISOString(), completedAt: done.toISOString(), submittedAt: done.toISOString(), dueSoonReminded: true, overdueReminded: true });
      run.progress[i] = { status: 'COMPLETED', dueAt: t.dueAt, completedAt: done.toISOString() };
      from = done;
    });
    // quiet history: no notifications for past demo runs
    db.notifications = db.notifications.filter((n) => !run.taskIds.includes(n.taskId));
    run.status = 'DONE';
    run.finishedAt = from.toISOString();
    made += 1;
  }
  save();
}

// Demo only: make today's sample run look "in progress" (step 1 already done by its person).
function demoProgress() {
  if (!db.demoWorkflowProgress) return;
  db.demoWorkflowProgress = false;
  const run = db.workflowRuns.find((r) => r.workflowId === 1 && r.date === localDay(new Date()));
  if (!run) return;
  const t = db.tasks.find((x) => x.id === run.taskIds[0]);
  const doneAt = new Date(Math.min(Date.now() - 5 * 60e3, at(run.date, run.startTime).getTime() + 1.5 * HOUR));
  if (doneAt <= at(run.date, run.startTime)) return;
  run.formData = db.demoFormData || null;
  run.formFilledBy = t.assigneeId;
  run.formFilledAt = at(run.date, run.startTime).toISOString();
  (t.checklist || []).forEach((c) => { c.done = true; c.doneAt = doneAt.toISOString(); });
  Object.assign(t, { status: 'COMPLETED', startedAt: at(run.date, run.startTime).toISOString(), completedAt: doneAt.toISOString(), submittedAt: doneAt.toISOString() });
  run.progress[0] = { status: 'COMPLETED', dueAt: t.dueAt, completedAt: doneAt.toISOString() };
  log(t.id, t.assigneeId, 'STATUS_CHANGED', 'IN_PROGRESS', 'COMPLETED', null);
  createStepTask(run, 1, doneAt);
  save();
}

// ---------------------------------------------------------- routes

function route(method, path, query, body, me) {
  const seg = path.replace(/^\/api\//, '').split('/');
  const id = seg[1] ? Number(seg[1]) : null;
  const isAdmin = me?.role === 'ADMIN';
  const needAdmin = () => { if (!isAdmin) throw forbidden(); };
  const linkedWorkflowId = (value) => {
    if (!value) return null;
    const workflowId = Number(value);
    const workflow = db.workflows?.find((wf) => wf.id === workflowId);
    const sourceTask = workflow?.sourceTaskId && db.tasks.find((task) => task.id === workflow.sourceTaskId);
    const canSee = workflow && (
      isAdmin || workflow.createdById === me.id || workflow.steps.some((step) => step.assigneeId === me.id)
      || (sourceTask && involved(sourceTask, me))
      || db.tasks.some((task) => task.workflowId === workflow.id && involved(task, me))
    );
    if (!canSee) throw bad('Choose an FMS you can access');
    return workflow.id;
  };

  // ----- auth
  if (path === '/api/auth/login' && method === 'POST') {
    const e = db.employees.find((x) => x.email.toLowerCase() === String(body.email).trim().toLowerCase());
    if (!e || !e.active || e.password !== body.password) throw new HttpError(401, 'Invalid email or password');
    return { token: `mock-${e.id}`, expiresInSeconds: 43200, user: empOut(e) };
  }
  if (!me) throw new HttpError(401, 'Not signed in');
  if (path === '/api/auth/me') return empOut(me);
  if (path === '/api/auth/change-password') {
    if (me.password !== body.currentPassword) throw bad('Current password is incorrect');
    if (!body.newPassword || body.newPassword.length < 8) throw bad('newPassword: must be at least 8 characters');
    me.password = body.newPassword;
    return null;
  }
  if (path === '/api/profile/photo') {
    if (method === 'GET') {
      if (!me.profilePhoto) return new Response(null, { status: 204 });
      const binary = atob(me.profilePhoto);
      return new Response(Uint8Array.from(binary, (char) => char.charCodeAt(0)), {
        headers: { 'Content-Type': 'image/jpeg' },
      });
    }
    if (method === 'PUT') {
      const image = String(body.image || '');
      if (!image || image.length > 7_000_000) throw bad('Choose an image smaller than 5 MB');
      me.profilePhoto = image;
      return null;
    }
    if (method === 'DELETE') {
      delete me.profilePhoto;
      return null;
    }
  }

  // ----- people directory: everyone can see who they can assign work to
  if (seg[0] === 'people' && method === 'GET') {
    return db.employees.filter((e) => e.active).sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map((e) => ({ id: e.id, fullName: e.fullName, department: e.department, designation: e.designation, role: e.role, active: true }));
  }

  // ----- employees (admin)
  if (seg[0] === 'employees') {
    needAdmin();
    if (!id && method === 'GET') return [...db.employees].sort((a, b) => a.fullName.localeCompare(b.fullName)).map(empOut);
    if (!id && method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!body.fullName?.trim()) throw bad('fullName: must not be blank');
      if (db.employees.some((e) => e.email === email)) throw new HttpError(409, 'An employee with this email already exists');
      if (!body.password || body.password.length < 8) throw bad('password: must be at least 8 characters');
      const e = { id: nextId(db.employees), employeeCode: body.employeeCode || null, fullName: body.fullName.trim(), email, password: body.password, role: body.role, department: body.department || null, designation: body.designation || null, phone: body.phone || null, active: true, createdAt: nowIso() };
      db.employees.push(e);
      return empOut(e);
    }
    const e = empById(id);
    if (!e) throw notFound('Employee');
    if (seg[2] === 'active') {
      const value = query.get('value') === 'true';
      if (e.id === me.id && !value) throw bad('You cannot deactivate your own account');
      e.active = value;
      return empOut(e);
    }
    if (seg[2] === 'reset-password') {
      if (!body.newPassword || body.newPassword.length < 8) throw bad('newPassword: must be at least 8 characters');
      e.password = body.newPassword;
      return null;
    }
    if (method === 'PUT') {
      if (!body.fullName?.trim()) throw bad('fullName: must not be blank');
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) throw bad('email: must not be blank');
      if (email !== e.email && db.employees.some((x) => x.email === email)) throw new HttpError(409, 'An employee with this email already exists');
      if (e.id === me.id && body.role !== 'ADMIN') throw bad('You cannot remove your own admin role');
      Object.assign(e, { employeeCode: body.employeeCode || null, fullName: body.fullName.trim(), email, role: body.role, department: body.department || null, designation: body.designation || null, phone: body.phone || null });
      return empOut(e);
    }
    return empOut(e);
  }

  // ----- tasks
  if (seg[0] === 'tasks') {
    if (!id && method === 'GET') {
      const statuses = query.getAll('status');
      // scope: assigned (to me) | created (by me, for others) | review (I am the reviewer). Admin default: everyone.
      const scope = query.get('scope') || (isAdmin ? 'all' : 'assigned');
      const assigneeId = scope === 'all' ? (isAdmin ? query.get('assigneeId') : null) : null;
      const inScope = (t) => scope === 'all' ? (isAdmin || involved(t, me))
        : scope === 'created' ? t.createdById === me.id && t.assigneeId !== me.id
          : scope === 'review' ? reviewerOf(t) === me.id
            : t.assigneeId === (isAdmin && query.get('assigneeId') ? Number(query.get('assigneeId')) : me.id);
      const priority = query.get('priority');
      const overdue = query.get('overdue') === 'true';
      const q = (query.get('q') || '').toLowerCase();
      const workFrom = query.get('workFrom') ? dayStart(query.get('workFrom')) : null;
      const workTo = query.get('workTo') ? addDays(dayStart(query.get('workTo')), 1) : null;
      return db.tasks
        .filter(inScope)
        .filter((t) => (!workFrom || new Date(workDate(t)) >= workFrom) && (!workTo || new Date(workDate(t)) < workTo))
        .filter((t) => !assigneeId || t.assigneeId === Number(assigneeId))
        .filter((t) => !statuses.length || statuses.includes(t.status))
        .filter((t) => !priority || t.priority === priority)
        .filter((t) => !overdue || isOverdue(t))
        .filter((t) => !q || t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
        .sort((a, b) => (a.dueAt ? new Date(a.dueAt) : Infinity) - (b.dueAt ? new Date(b.dueAt) : Infinity))
        .map(taskOut);
    }
    if (!id && method === 'POST') {
      if (!body.title?.trim()) throw bad('title: must not be blank');
      // Anyone can assign work to anyone. Default reviewer: the person assigning (none for own work).
      const a = body.assigneeId ? activeAssignee(body.assigneeId) : me;
      const self = a.id === me.id;
      const reviewerId = pickReviewer(body.reviewerId, a.id, self ? null : me.id);
      const allowed = reviewerId ? ['TODO', 'IN_PROGRESS'] : ['TODO', 'IN_PROGRESS', 'COMPLETED'];
      const status = self && allowed.includes(body.status) ? body.status : 'TODO';
      const now = nowIso();
      const estimatedHours = parseEstimatedHours(body.estimatedHours);
      const t = {
        id: nextId(db.tasks), title: body.title.trim(), description: body.description || '', assigneeId: a.id, createdById: me.id,
        priority: body.priority || 'MEDIUM', status,
        dueAt: estimatedHours != null
          ? (status === 'TODO' ? null : workDeadline(now, estimatedHours).toISOString())
          : localToIso(body.dueAt),
        estimatedHours, createdAt: now, updatedAt: now,
        startedAt: status === 'TODO' ? null : now, submittedAt: status === 'COMPLETED' ? now : null, completedAt: status === 'COMPLETED' ? now : null,
        recurringTemplateId: null, dueSoonReminded: false, overdueReminded: false, reviewerId,
        workflowId: linkedWorkflowId(body.workflowId),
      };
      db.tasks.push(t);
      const rv = reviewerId ? empById(reviewerId) : null;
      log(t.id, me.id, 'CREATED', null, status, [self ? 'Added own work' : null, rv ? `Reviewer: ${rv.fullName}` : null].filter(Boolean).join('. ') || null);
      if (!self) notify(a.id, t.id, 'TASK_ASSIGNED', `${me.fullName} assigned you: ${t.title}`);
      if (rv && rv.id !== me.id) notify(rv.id, t.id, 'REVIEW_ASSIGNED', `${me.fullName} made you the reviewer for "${t.title}" (${a.fullName})`);
      return taskOut(t);
    }

    const t = getTask(id, me);
    if (seg[2] === 'activity') return db.activity.filter((a) => a.taskId === id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map(activityOut);

    if (seg[2] === 'checklist' && method === 'POST') {
      if (t.assigneeId !== me.id && !isAdmin) throw forbidden('Only the person doing this step can tick its checklist');
      if (!OPEN.includes(t.status)) throw bad('This task is closed');
      const item = (t.checklist || [])[Number(body.index)];
      if (!item) throw notFound('Checklist item');
      item.done = !!body.done;
      item.doneAt = item.done ? nowIso() : null;
      log(id, me.id, 'UPDATED', null, null, `${item.done ? 'Ticked' : 'Unticked'}: ${item.text}`);
      return taskOut(t);
    }

    if (seg[2] === 'comments') {
      if (!body.comment?.trim()) throw bad('comment: must not be blank');
      const a = log(id, me.id, 'COMMENTED', null, null, body.comment.trim());
      const msg = `${me.fullName} commented on "${t.title}": ${body.comment.trim()}`;
      [...new Set([t.assigneeId, t.createdById, reviewerOf(t)])].filter((x) => x && x !== me.id).forEach((x) => notify(x, id, 'COMMENT', msg));
      return activityOut(a);
    }

    if (seg[2] === 'status') {
      const from = t.status;
      const to = body.status;
      if (from === to) throw bad(`Task is already ${to}`);
      const mine = t.assigneeId === me.id;
      const reviewer = reviewerOf(t);
      const noReview = reviewer == null; // own work with no reviewer: the person can close it themselves
      const allowed = (mine && noReview && SELF_MOVES[from]?.includes(to))
        || (mine && ASSIGNEE_MOVES[from]?.includes(to))
        || (reviewer === me.id && REVIEWER_MOVES[from]?.includes(to))
        || (t.createdById === me.id && CREATOR_MOVES[from]?.includes(to))
        || (isAdmin && ADMIN_MOVES[from]?.includes(to));
      if (!allowed) throw forbidden(`You cannot move this task from ${from} to ${to}`);
      if (t.workflowRunId && to === 'CANCELLED' && !isAdmin && t.createdById !== me.id) throw forbidden('Only the workflow owner can stop it');
      if (t.workflowRunId && t.workflowStep === 1 && ['IN_PROGRESS', 'COMPLETED'].includes(to)) {
        const run = db.workflowRuns.find((r) => r.id === t.workflowRunId);
        if (run && needsForm(run)) throw bad('Fill the workflow form first. The work starts after the form is filled.');
      }
      if (to === 'COMPLETED' && mine && (t.checklist || []).some((c) => !c.done)) {
        throw bad('Tick every checklist item first, then mark the step done');
      }
      if (to === 'REOPENED' && !body.comment?.trim()) throw bad('Please add a comment explaining what needs to be redone');
      if (t.workflowRunId && from === 'COMPLETED') {
        const run = db.workflowRuns.find((r) => r.id === t.workflowRunId);
        if (run?.taskIds[t.workflowStep]) throw bad('The next step has already started, so this step stays done');
      }
      const now = nowIso();
      t.status = to;
      t.updatedAt = now;
      if (t.estimatedHours != null && (to === 'IN_PROGRESS' || (to === 'COMPLETED' && !t.startedAt))) {
        t.startedAt = now;
        const run = t.workflowRunId && db.workflowRuns.find((r) => r.id === t.workflowRunId);
        t.dueAt = workDeadline(now, t.estimatedHours, run?.startTime || '10:00', run?.endTime || '18:00').toISOString();
        t.dueSoonReminded = false;
        t.overdueReminded = false;
      } else if (t.estimatedHours != null && ['TODO', 'REOPENED'].includes(to)) {
        t.dueAt = null;
        t.dueSoonReminded = false;
        t.overdueReminded = false;
      } else if (to === 'IN_PROGRESS' && !t.startedAt) t.startedAt = now;
      if (to === 'SUBMITTED') t.submittedAt = now;
      if (to === 'COMPLETED') { t.completedAt = now; t.submittedAt ||= now; }
      if (to === 'REOPENED' || to === 'TODO') { t.completedAt = null; t.submittedAt = null; }
      log(id, me.id, 'STATUS_CHANGED', from, to, body.comment?.trim());
      onWorkflowTaskStatus(t, to);
      if (to === 'SUBMITTED' && reviewer) {
        const rv = empById(reviewer);
        const msg = `${me.fullName} submitted "${t.title}" for your review`;
        if (rv?.active) notify(rv.id, id, 'TASK_SUBMITTED', msg);
        else db.employees.filter((e) => e.role === 'ADMIN' && e.active).forEach((e) => notify(e.id, id, 'TASK_SUBMITTED', msg));
      }
      if (to === 'COMPLETED' && !mine) {
        notify(t.assigneeId, id, 'TASK_APPROVED', `${me.fullName} approved: ${t.title}`);
        if (t.createdById !== me.id && t.createdById !== t.assigneeId) notify(t.createdById, id, 'TASK_APPROVED', `${me.fullName} approved "${t.title}" (${empById(t.assigneeId)?.fullName})`);
      }
      if (to === 'REOPENED') notify(t.assigneeId, id, 'TASK_REOPENED', `${me.fullName} sent back "${t.title}": ${body.comment.trim()}`);
      return taskOut(t);
    }

    const canEdit = isAdmin || t.createdById === me.id; // admin, or whoever assigned / added it
    if (method === 'PUT') {
      if (!canEdit) throw forbidden('Only the person who assigned this task can change it');
      if (!body.title?.trim()) throw bad('title: must not be blank');
      if (!body.assigneeId) body.assigneeId = t.assigneeId;
      const newDue = localToIso(body.dueAt);
      const estimatedHours = parseEstimatedHours(body.estimatedHours);
      const due = estimatedHours != null && t.startedAt && !['TODO', 'REOPENED'].includes(t.status)
        ? workDeadline(t.startedAt, estimatedHours,
          db.workflowRuns.find((r) => r.id === t.workflowRunId)?.startTime || '10:00',
          db.workflowRuns.find((r) => r.id === t.workflowRunId)?.endTime || '18:00').toISOString()
        : estimatedHours != null ? null : newDue;
      const changes = [];
      if (t.title !== body.title.trim()) changes.push('title');
      if (t.priority !== body.priority) changes.push(`priority ${t.priority} → ${body.priority}`);
      if (t.dueAt !== due) changes.push('due date');
      if (t.estimatedHours !== estimatedHours) changes.push('estimated effort');
      if (t.assigneeId !== Number(body.assigneeId)) {
        const prev = empById(t.assigneeId);
        const next = activeAssignee(body.assigneeId);
        t.assigneeId = next.id;
        log(id, me.id, 'REASSIGNED', null, null, `Reassigned from ${prev.fullName} to ${next.fullName}`);
        notify(next.id, id, 'TASK_ASSIGNED', `New task: ${body.title.trim()}`);
      }
      if ('reviewerId' in body) {
        const next = pickReviewer(body.reviewerId, t.assigneeId, t.createdById !== t.assigneeId ? t.createdById : null);
        if (next !== reviewerOf(t)) {
          t.reviewerId = next;
          const rv = next ? empById(next) : null;
          changes.push(rv ? `reviewer → ${rv.fullName}` : 'no review needed');
          if (rv && rv.id !== me.id) notify(rv.id, id, 'REVIEW_ASSIGNED', `${me.fullName} made you the reviewer for "${t.title}"`);
        }
      }
      Object.assign(t, { title: body.title.trim(), description: body.description || '', priority: body.priority, dueAt: due,
        estimatedHours, updatedAt: nowIso() });
      if (changes.length) log(id, me.id, 'UPDATED', null, null, `Changed ${changes.join(', ')}`);
      return taskOut(t);
    }
    if (method === 'DELETE') {
      if (!canEdit) throw forbidden();
      db.tasks = db.tasks.filter((x) => x.id !== id);
      db.activity = db.activity.filter((a) => a.taskId !== id);
      db.notifications = db.notifications.filter((n) => n.taskId !== id);
      return null;
    }
    return taskOut(t);
  }

  // ----- recurring: admins manage all; employees manage their own daily/weekly tasks
  if (seg[0] === 'recurring') {
    const visible = isAdmin ? db.recurring : db.recurring.filter((r) => r.assigneeId === me.id);
    if (!id && method === 'GET') return [...visible].sort((a, b) => a.title.localeCompare(b.title)).map(templateOut);
    const apply = (tpl) => {
      if (!body.title?.trim()) throw bad('title: must not be blank');
      if (!['DAILY', 'WEEKLY'].includes(body.frequency)) throw bad('Choose how often this task repeats');
      if (body.frequency === 'WEEKLY' && !body.dayOfWeek) throw bad('Choose a day of the week for weekly tasks');
      if (body.frequency === 'WEEKLY' && body.dayOfWeek === 'SUNDAY') throw bad('Sunday is the weekly off. Choose Monday to Saturday.');
      const estimatedHours = parseEstimatedHours(body.estimatedHours);
      const a = isAdmin ? activeAssignee(body.assigneeId) : me;
      Object.assign(tpl, {
        title: body.title.trim(), description: body.description || '', assigneeId: a.id, priority: body.priority || 'MEDIUM',
        frequency: body.frequency, dayOfWeek: body.frequency === 'WEEKLY' ? body.dayOfWeek : null,
        dueTime: (body.dueTime || '18:00').length === 5 ? `${body.dueTime || '18:00'}:00` : body.dueTime,
        estimatedHours,
        workflowId: body.workflowId === undefined ? (tpl.workflowId || null) : linkedWorkflowId(body.workflowId),
      });
      return tpl;
    };
    if (!id && method === 'POST') {
      const tpl = apply({ id: nextId(db.recurring), createdById: me.id, active: true, lastGeneratedOn: null, createdAt: nowIso() });
      db.recurring.push(tpl);
      runRecurring(); // fill in the next 7 days straight away
      return templateOut(tpl);
    }
    const tpl = visible.find((x) => x.id === id);
    if (!tpl) throw notFound('Repeating task');
    // employees may only change repeating tasks they set up themselves
    if (!isAdmin && method !== 'GET' && tpl.createdById !== me.id) throw forbidden('Only your admin can change this repeating task');
    if (seg[2] === 'active') {
      tpl.active = query.get('value') === 'true';
      if (!tpl.active) removeFutureCopies(tpl.id); else runRecurring();
      return templateOut(tpl);
    }
    if (seg[2] === 'generate-now') {
      const today = localDay(new Date());
      if (alreadyCreated(tpl, today)) throw bad('Today’s task for this template has already been created');
      if (new Date().getDay() === 0 || holidayOn(today)) throw bad('Today is a weekly off or an office holiday, so no task is created');
      createFromTemplate(tpl, today);
      return null;
    }
    if (method === 'PUT') {
      apply(tpl);
      removeFutureCopies(tpl.id);
      runRecurring();
      return templateOut(tpl);
    }
    if (method === 'DELETE') {
      removeFutureCopies(id);
      db.recurring = db.recurring.filter((x) => x.id !== id);
      db.tasks.forEach((x) => { if (x.recurringTemplateId === id) x.recurringTemplateId = null; });
      return null;
    }
    return templateOut(tpl);
  }

  // ----- workflows (FMS): admins see all; others see the ones they set up or have a step in
  if (seg[0] === 'workflows') {
    db.workflows ||= []; db.workflowRuns ||= [];
    const onTask = (taskId) => { const t = taskId && db.tasks.find((x) => x.id === taskId); return !!t && (isAdmin || involved(t, me)); };
    const mineWf = (wf) => isAdmin || wf.createdById === me.id || wf.steps.some((st) => st.assigneeId === me.id)
      || onTask(wf.sourceTaskId) || db.tasks.some((t) => t.workflowId === wf.id && involved(t, me));
    const mineRun = (r) => isAdmin || r.createdById === me.id || r.steps.some((st) => st.assigneeId === me.id) || onTask(r.sourceTaskId);
    const canChange = (wf) => isAdmin || wf.createdById === me.id;

    if (seg[1] === 'runs') {
      if (seg[2]) {
        const run = db.workflowRuns.find((r) => r.id === Number(seg[2]));
        if (!run) throw notFound('Workflow run');
        if (!mineRun(run)) throw notFound('Workflow run');
        if (seg[3] === 'form' && method === 'POST') {
          if (!needsForm(run)) throw bad('The form for this run is already filled');
          if (!isAdmin && run.createdById !== me.id && run.steps[0].assigneeId !== me.id) throw forbidden('Only step 1’s person fills this form');
          saveRunForm(run, body.formData || {}, me.id);
        }
        return runOut(run);
      }
      const taskId = Number(query.get('taskId')) || null;
      const date = query.get('date') || localDay(new Date());
      return db.workflowRuns
        .filter((r) => (taskId ? r.sourceTaskId === taskId : r.date === date) && mineRun(r))
        .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.name.localeCompare(b.name))
        .map(runOut);
    }

    const apply = (wf) => {
      if (!body.name?.trim()) throw bad('Give the workflow a name');
      if (body.frequency === 'WEEKLY' && !body.dayOfWeek) throw bad('Choose a day of the week for weekly workflows');
      const steps = (body.steps || []).filter((st) => st.title?.trim());
      if (steps.length < 2) throw bad('A workflow needs at least 2 steps');
      if (!/^\d{2}:\d{2}/.test(body.startTime || '') || !/^\d{2}:\d{2}/.test(body.endTime || '')) throw bad('Set a start time and an end time');
      if (body.endTime <= body.startTime) throw bad('End time must be after start time');
      const TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'];
      const usedIds = new Set();
      const formFields = (body.formFields || []).filter((f) => f.label?.trim()).map((f, i) => {
        if (!TYPES.includes(f.type)) throw bad(`Form field ${i + 1}: choose a field type`);
        const options = f.type === 'select'
          ? (Array.isArray(f.options) ? f.options : String(f.options || '').split(',')).map((o) => o.trim()).filter(Boolean) : [];
        if (f.type === 'select' && options.length < 2) throw bad(`“${f.label}”: give at least 2 options, separated by commas`);
        let fid = f.id && !usedIds.has(f.id) ? f.id : null;
        for (let n = i + 1; !fid; n++) if (!usedIds.has(`f${n}`) && !(body.formFields || []).some((x) => x.id === `f${n}`)) fid = `f${n}`;
        usedIds.add(fid);
        return { id: fid, label: f.label.trim(), type: f.type, required: !!f.required, options };
      });
      if (!['DAILY', 'WEEKLY', 'ON_DEMAND'].includes(body.frequency)) throw bad('Choose how often this FMS runs');
      let sourceTaskId = null;
      if (body.sourceTaskId) {
        const src = db.tasks.find((x) => x.id === Number(body.sourceTaskId));
        if (src && (isAdmin || involved(src, me))) sourceTaskId = src.id;
        else if (wf.sourceTaskId === Number(body.sourceTaskId)) sourceTaskId = wf.sourceTaskId;
        else throw bad('Choose a task you can see');
      }
      Object.assign(wf, {
        formFields, sourceTaskId,
        name: body.name.trim(), description: body.description || '', frequency: body.frequency,
        dayOfWeek: body.frequency === 'WEEKLY' ? body.dayOfWeek : null,
        startTime: body.startTime.slice(0, 5), endTime: body.endTime.slice(0, 5),
        steps: steps.map((st, i) => {
          const hours = Number(st.hours);
          if (!(hours > 0 && hours <= 24)) throw bad(`Step ${i + 1}: hours must be between 0.25 and 24`);
          const checklist = (st.checklist || []).map((c) => String(c).trim()).filter(Boolean);
          return { title: st.title.trim(), assigneeId: activeAssignee(st.assigneeId).id, hours, priority: st.priority || 'MEDIUM', how: (st.how || '').trim(), checklist };
        }),
      });
      return wf;
    };

    if (!id && method === 'GET') {
      const taskId = Number(query.get('taskId')) || null;
      const task = taskId && db.tasks.find((t) => t.id === taskId);
      return db.workflows.filter((w) => mineWf(w) && (!taskId || w.sourceTaskId === taskId || task?.workflowId === w.id))
        .sort((a, b) => a.name.localeCompare(b.name)).map(workflowOut);
    }
    if (!id && method === 'POST') {
      const wf = apply({ id: nextId(db.workflows), createdById: me.id, active: true, lastRunOn: null, createdAt: nowIso() });
      db.workflows.push(wf);
      if (body.startNow && wf.sourceTaskId) {
        startRun(wf, localDay(new Date()), { by: me.id, manual: true, sourceTaskId: wf.sourceTaskId });
      } else {
        runWorkflows(); // starts today's scheduled run if it runs today
      }
      return workflowOut(wf);
    }
    const wf = db.workflows.find((w) => w.id === id);
    if (!wf || !mineWf(wf)) throw notFound('Workflow');
    if (method !== 'GET' && seg[2] !== 'start-now' && !(method === 'PUT' || canChange(wf))) {
      throw forbidden('Only the person who set up this workflow (or an admin) can change it');
    }
    // Tracker: every run of this FMS between two dates, newest first (like rows of the FMS sheet)
    if (seg[2] === 'runs' && method === 'GET') {
      const from = query.get('from') || '0000-00-00';
      const to = query.get('to') || '9999-12-31';
      return db.workflowRuns.filter((r) => r.workflowId === wf.id && r.date >= from && r.date <= to)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(runOut);
    }
    if (seg[2] === 'active') { wf.active = query.get('value') === 'true'; if (wf.active) runWorkflows(); return workflowOut(wf); }
    if (seg[2] === 'start-now') {
      if (!wf.active) throw bad('This workflow is paused');
      const run = startRun(wf, localDay(new Date()), {
        formData: (wf.formFields || []).length ? body.formData || {} : null, by: me.id, manual: true,
        sourceTaskId: Number(body.sourceTaskId) || wf.sourceTaskId || null,
      });
      return runOut(run);
    }
    if (method === 'PUT') return workflowOut(apply(wf)); // takes effect from the next run
    if (method === 'DELETE') { db.workflows = db.workflows.filter((w) => w.id !== id); return null; }
    return workflowOut(wf);
  }

  // ----- office holidays: everyone can see, admin can change
  if (seg[0] === 'holidays') {
    db.holidays ||= [];
    if (!id && method === 'GET') {
      const year = query.get('year');
      const from = query.get('from');
      const to = query.get('to');
      return db.holidays
        .filter((h) => (!year || h.date.startsWith(year)) && (!from || h.date >= from) && (!to || h.date <= to))
        .sort((a, b) => a.date.localeCompare(b.date));
    }
    needAdmin();
    const check = () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) throw bad('Choose a date');
      if (!body.name?.trim()) throw bad('Give the holiday a name');
      const clash = db.holidays.find((h) => h.date === body.date && h.id !== id);
      if (clash) throw bad(`${body.date} is already a holiday (${clash.name})`);
    };
    const removeTasksOn = (day) => {
      // repeating tasks that were already created for that day are no longer needed
      const gone = new Set(db.tasks.filter((t) => t.recurringTemplateId && t.status === 'TODO' && t.dueAt
        && localDay(new Date(t.dueAt)) === day).map((t) => t.id));
      db.tasks = db.tasks.filter((t) => !gone.has(t.id));
      db.activity = db.activity.filter((a) => !gone.has(a.taskId));
    };
    if (!id && method === 'POST') {
      check();
      const h = { id: nextId(db.holidays), date: body.date, name: body.name.trim(), note: body.note?.trim() || '', createdAt: nowIso() };
      db.holidays.push(h);
      removeTasksOn(h.date);
      return h;
    }
    const h = db.holidays.find((x) => x.id === id);
    if (!h) throw notFound('Holiday');
    if (method === 'PUT') {
      check();
      const oldDate = h.date;
      Object.assign(h, { date: body.date, name: body.name.trim(), note: body.note?.trim() || '' });
      removeTasksOn(h.date);
      if (oldDate !== h.date) runRecurring(); // the old date is a working day again
      return h;
    }
    if (method === 'DELETE') {
      db.holidays = db.holidays.filter((x) => x.id !== id);
      runRecurring();
      return null;
    }
    return h;
  }

  // ----- notifications (own)
  if (seg[0] === 'notifications') {
    const mineList = db.notifications.filter((n) => n.recipientId === me.id);
    if (seg[1] === 'unread-count') return { count: mineList.filter((n) => !n.read).length };
    if (seg[1] === 'read-all') { mineList.forEach((n) => { n.read = true; }); return null; }
    if (seg[2] === 'read') {
      const n = mineList.find((x) => x.id === id);
      if (!n) throw notFound('Notification');
      n.read = true;
      return null;
    }
    return mineList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50)
      .map(({ recipientId, ...n }) => n);
  }

  // ----- reports
  if (seg[0] === 'reports') {
    const visible = isAdmin ? db.tasks : db.tasks.filter((t) => t.assigneeId === me.id);

    // Monthly performance + 6-month trend for one employee
    if (seg[1] === 'performance') {
      const empId = isAdmin ? Number(query.get('employeeId')) || me.id : me.id;
      if (!empById(empId)) throw notFound('Employee');
      const key = query.get('month') || monthKey(new Date());
      const [from, to] = monthRange(key);
      const trend = [];
      for (let i = 5; i >= 0; i--) {
        const k = monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1));
        const [a, b] = monthRange(k);
        const p = performance(empId, a, b);
        trend.push({ month: k, score: p.score, total: p.total, completed: p.completed, onTimeRate: p.onTimeRate });
      }
      return { employeeId: empId, month: key, ...performance(empId, from, to), trend };
    }

    // Twelve months for one employee
    if (seg[1] === 'yearly') {
      const empId = isAdmin ? Number(query.get('employeeId')) || me.id : me.id;
      const year = Number(query.get('year')) || new Date().getFullYear();
      const months = [];
      for (let m = 0; m < 12; m++) {
        const k = `${year}-${String(m + 1).padStart(2, '0')}`;
        const [a, b] = monthRange(k);
        months.push({ month: k, ...performance(empId, a, b) });
      }
      return { employeeId: empId, year, ...performance(empId, new Date(year, 0, 1), new Date(year + 1, 0, 1)), months };
    }

    // Admin: one card per employee — today's work, overdue, this month's score
    if (seg[1] === 'team') {
      needAdmin();
      const period = query.get('period') || 'today';
      const today = dayStart(localDay(new Date()));
      let rangeStart;
      let rangeEnd;
      if (period === 'today') {
        rangeStart = today;
        rangeEnd = addDays(today, 1);
      } else if (period === 'week') {
        rangeStart = addDays(today, -((today.getDay() + 6) % 7));
        rangeEnd = addDays(rangeStart, 7);
      } else if (period === 'month') {
        rangeStart = new Date(today.getFullYear(), today.getMonth(), 1);
        rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      } else {
        throw bad('Period must be today, week, or month');
      }
      const [from, to] = monthRange(monthKey(new Date()));
      return db.employees.filter((e) => e.role === 'EMPLOYEE').sort((a, b) => a.fullName.localeCompare(b.fullName)).map((e) => {
        const p = performance(e.id, from, to);
        const todayTasks = db.tasks
          .filter((t) => t.assigneeId === e.id && t.status !== 'CANCELLED' && between(workDate(t), today, addDays(today, 1)))
          .sort((a, b) => new Date(workDate(a)) - new Date(workDate(b)))
          .map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt, overdue: !!isOverdue(t) }));
        const rangeTasks = db.tasks
          .filter((t) => t.assigneeId === e.id && t.status !== 'CANCELLED' && between(workDate(t), rangeStart, rangeEnd))
          .sort((a, b) => new Date(workDate(a)) - new Date(workDate(b)))
          .map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt, overdue: !!isOverdue(t) }));
        return {
          employee: empOut(e), today: todayCounts(e.id), todayTasks,
          range: {
            total: rangeTasks.length,
            todo: rangeTasks.filter((t) => t.status === 'TODO' || t.status === 'REOPENED').length,
            inProgress: rangeTasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'SUBMITTED').length,
            done: rangeTasks.filter((t) => t.status === 'COMPLETED').length,
          },
          rangeTasks,
          rangeOverdue: rangeTasks.filter((t) => t.overdue).length,
          overdue: db.tasks.filter((t) => t.assigneeId === e.id && isOverdue(t)).length,
          waitingReview: db.tasks.filter((t) => t.assigneeId === e.id && t.status === 'SUBMITTED').length,
          month: { score: p.score, rating: p.rating, total: p.total, completed: p.completed, onTimeRate: p.onTimeRate },
        };
      });
    }

    if (seg[1] === 'dashboard') {
      const today = dayStart(localDay(new Date()));
      const tomorrow = addDays(today, 1);
      const monday = addDays(today, -((today.getDay() + 6) % 7));
      const open = visible.filter((t) => OPEN.includes(t.status));
      const done = visible.filter((t) => t.status === 'COMPLETED');
      const openByPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
      open.forEach((t) => { openByPriority[t.priority] += 1; });
      return {
        totalOpen: open.length,
        todo: open.filter((t) => t.status === 'TODO' || t.status === 'REOPENED').length,
        inProgress: open.filter((t) => t.status === 'IN_PROGRESS').length,
        awaitingReview: open.filter((t) => t.status === 'SUBMITTED').length,
        overdue: open.filter(isOverdue).length,
        dueToday: open.filter((t) => between(t.dueAt, today, tomorrow)).length,
        completedToday: done.filter((t) => between(t.completedAt, today, tomorrow)).length,
        completedThisWeek: done.filter((t) => between(t.completedAt, monday, tomorrow)).length,
        openByPriority,
      };
    }

    const from = dayStart(query.get('from'));
    const to = addDays(dayStart(query.get('to')), 1);
    if (isNaN(from) || isNaN(to)) throw bad('Invalid request: check the values you sent');
    if (to <= from) throw bad("'to' date must be on or after 'from' date");

    if (seg[1] === 'employees' || seg[1] === 'employees.csv') {
      needAdmin();
      const rows = [];
      [...db.employees].sort((a, b) => a.fullName.localeCompare(b.fullName)).forEach((e) => {
        const mine = db.tasks.filter((t) => t.assigneeId === e.id);
        const open = mine.filter((t) => OPEN.includes(t.status));
        const touched = mine.filter((t) => between(t.createdAt, from, to) || between(t.completedAt, from, to) || between(t.dueAt, from, to));
        if (!touched.length && !open.length && (e.role === 'ADMIN' || !e.active)) return;
        const completed = touched.filter((t) => t.status === 'COMPLETED' && between(t.completedAt, from, to));
        const ok = completed.filter(onTime).length;
        const hours = completed.map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / 3600e3);
        rows.push({
          employeeId: e.id, employeeName: e.fullName, department: e.department,
          assigned: touched.filter((t) => between(t.createdAt, from, to)).length,
          completed: completed.length, completedOnTime: ok, completedLate: completed.length - ok,
          openNow: open.length, overdueNow: open.filter(isOverdue).length,
          onTimeRate: completed.length ? round1((100 * ok) / completed.length) : null,
          avgCompletionHours: hours.length ? round1(hours.reduce((s, h) => s + h, 0) / hours.length) : null,
        });
      });
      if (seg[1] === 'employees') return rows;
      const esc = (s) => (s == null ? '' : /[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
      const csv = 'Employee,Department,Assigned,Completed,On time,Late,Open now,Overdue now,On-time %,Avg hours to complete\n' +
        rows.map((r) => [esc(r.employeeName), esc(r.department), r.assigned, r.completed, r.completedOnTime, r.completedLate, r.openNow, r.overdueNow, r.onTimeRate ?? '', r.avgCompletionHours ?? ''].join(',')).join('\n');
      return new Response(csv, { headers: { 'Content-Type': 'text/csv' } });
    }

    if (seg[1] === 'daily') {
      const empId = isAdmin ? Number(query.get('employeeId')) || null : me.id;
      const list = db.tasks.filter((t) => !empId || t.assigneeId === empId);
      const out = [];
      for (let d = new Date(from); d < to; d = addDays(d, 1)) {
        const e = addDays(d, 1);
        const doneToday = list.filter((t) => t.status === 'COMPLETED' && between(t.completedAt, d, e));
        out.push({
          date: localDay(d),
          created: list.filter((t) => between(t.createdAt, d, e)).length,
          due: list.filter((t) => between(t.dueAt, d, e)).length,
          completed: doneToday.length,
          completedOnTime: doneToday.filter(onTime).length,
        });
      }
      return out;
    }
  }

  throw new HttpError(404, 'Not found');
}

// Pretend network delay. Tests set it to 0 with setMockDelay(0).
let delayMs = 120;
export function setMockDelay(ms) { delayMs = ms; }

/** Entry point used by http.js. Returns { status, data } like a real HTTP call. */
export async function mockFetch(method, fullPath, body, token) {
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs)); // feel like a network call
  db.workflows ||= []; db.workflowRuns ||= [];
  runRecurring();
  runWorkflows();
  demoProgress();
  demoHistory();
  runDeadlineReminders();
  const url = new URL(fullPath, 'http://mock');
  const meId = token?.startsWith('mock-') ? Number(token.slice(5)) : null;
  const me = meId ? db.employees.find((e) => e.id === meId && e.active) : null;
  if (me) ensureDailyDigest(me);
  try {
    const data = route(method, url.pathname, url.searchParams, body || {}, me);
    if (method !== 'GET') save();
    return { status: data == null ? 204 : 200, data };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, data: { status: e.status, message: e.message } };
    console.error('[mock api]', e);
    return { status: 500, data: { status: 500, message: 'Something went wrong. Please try again.' } };
  }
}
