// ============================================================
//  DUMMY DATA — edit freely. Used only while VITE_USE_MOCK=true.
//  After editing, open Account → "Reset demo data" in the app.
//
//  Besides the hand-written tasks below, about 8 months of past
//  work is generated for every employee, so the Week / Month /
//  Year views and the monthly performance have something to show.
// ============================================================

const H = 3600e3;
const D = 24 * H;

export const EMPLOYEES = [
  { id: 1, employeeCode: 'ADM-001', fullName: 'System Admin', email: 'admin@company.com', password: 'Admin@123', role: 'ADMIN', department: 'Management', designation: 'Administrator', phone: '9800000001' },
  { id: 2, employeeCode: 'EMP-101', fullName: 'Priya Sharma', email: 'priya@company.com', password: 'Employee@123', role: 'EMPLOYEE', department: 'Accounts', designation: 'Accounts Executive', phone: '9800000002' },
  { id: 3, employeeCode: 'EMP-102', fullName: 'Rahul Patil', email: 'rahul@company.com', password: 'Employee@123', role: 'EMPLOYEE', department: 'Purchase', designation: 'Purchase Officer', phone: '9800000003' },
  { id: 4, employeeCode: 'EMP-103', fullName: 'Sneha Kulkarni', email: 'sneha@company.com', password: 'Employee@123', role: 'EMPLOYEE', department: 'Projects', designation: 'Site Coordinator', phone: '9800000004' },
  { id: 5, employeeCode: 'EMP-104', fullName: 'Amit Deshmukh', email: 'amit@company.com', password: 'Employee@123', role: 'EMPLOYEE', department: 'Projects', designation: 'Site Supervisor', phone: '9800000005' },
];

/** Typical work per department, used to generate history. */
const WORK_BY_DEPT = {
  Accounts: ['Bank reconciliation', 'Vendor payment entries', 'GST invoice check', 'Petty cash update', 'Expense voucher entry', 'Salary sheet check', 'TDS working', 'Outstanding follow-up calls'],
  Purchase: ['Collect vendor quotations', 'Raise purchase order', 'Follow up material delivery', 'Update purchase register', 'Compare rates for tiles', 'Vendor bill verification', 'GRN entry', 'New vendor documents'],
  Projects: ['Daily site progress report', 'Labour attendance', 'Material balance check', 'Site photos upload', 'Client snag list follow-up', 'Measurement sheet', 'Safety checklist', 'Coordinate with contractor'],
};

// Hand-written tasks around today:
// [title, assigneeId, priority, due offset, status, created offset, description, assignedById = 1 (admin), reviewerId]
const CURRENT = [
  ['Prepare GST summary for October', 2, 'HIGH', -20 * H, 'TODO', -4 * D, 'Compile GSTR-1 and GSTR-3B figures from the sales register.'],
  ['Material balance check, Pirangut site', 4, 'URGENT', -3 * H, 'IN_PROGRESS', -2 * D, 'Count cement, tiles and plywood on site and match with the material tracker.'],
  ['Collect 3 quotations for plywood', 3, 'URGENT', 4 * H, 'SUBMITTED', -3 * D, '18 mm BWP plywood, 120 sheets. Need 3 vendor quotes with delivery time.'],
  ['Reconcile vendor payments', 2, 'HIGH', 6 * H, 'IN_PROGRESS', -3 * D, 'Check every vendor statement against the purchase register and flag mismatches.'],
  ['Update purchase register', 3, 'LOW', 3 * D, 'REOPENED', -5 * D, 'Add last week’s bills to the master purchase register.'],
  ['Vendor onboarding documents', 3, 'MEDIUM', 12 * D, 'TODO', -1 * D, 'Collect GST certificate, PAN and bank details from the two new vendors.'],
  ['Labour attendance sheet, Kharadi', 5, 'MEDIUM', 1 * D, 'TODO', -1 * D, ''],
  // employees assigning work to each other, with a reviewer of their choice
  ['Share site measurement for tile quantity', 4, 'HIGH', 5 * H, 'SUBMITTED', -1 * D, 'Rahul needs the measurement sheet to order tiles.', 3, 3],
  ['Verify vendor bill for plywood order', 2, 'MEDIUM', 1 * D, 'IN_PROGRESS', -1 * D, 'Match the bill with the PO and GRN.', 3, 3],
  ['Send labour count for payroll', 5, 'MEDIUM', 2 * D, 'TODO', -2 * H, '', 2, 2],
  ['Prepare material request for next week', 5, 'HIGH', 8 * H, 'SUBMITTED', -2 * D, 'Sneha assigned this; Rahul (Purchase) checks it.', 4, 3],
];

const RECURRING = [
  { id: 1, title: 'Daily site progress report', description: 'Share today’s progress, manpower and material used.', assigneeId: 4, priority: 'MEDIUM', frequency: 'DAILY', dayOfWeek: null, dueTime: '19:00:00', active: true },
  { id: 2, title: 'Weekly purchase summary', description: '', assigneeId: 3, priority: 'MEDIUM', frequency: 'WEEKLY', dayOfWeek: 'MONDAY', dueTime: '17:00:00', active: true },
  { id: 3, title: 'Petrol expense submission', description: '', assigneeId: 5, priority: 'LOW', frequency: 'WEEKLY', dayOfWeek: 'SATURDAY', dueTime: '13:00:00', active: false },
  // set up by the employee herself
  { id: 4, title: 'Check bank balance and update cash book', description: '', assigneeId: 2, createdById: 2, priority: 'MEDIUM', frequency: 'DAILY', dayOfWeek: null, dueTime: '11:00:00', active: true },
];

/**
 * FMS-style workflows: steps run one after another. Step 1 is assigned at the start time;
 * when a step is done, the next one is assigned with `hours` to finish it.
 */
const WORKFLOWS = [
  {
    id: 1, name: 'Daily purchase cycle', frequency: 'DAILY', dayOfWeek: null, startTime: '10:00', endTime: '19:00',
    description: 'Site needs → quotations → budget check → purchase order, the same day.',
    // Filled each time the workflow runs. Every step sees these answers.
    formFields: [
      { id: 'f1', label: 'Site', type: 'select', required: true, options: ['Coca-Cola Pirangut', 'PIL', 'Infosys SDB 7', 'AIGP Kharadi'] },
      { id: 'f2', label: 'Material required', type: 'text', required: true, options: [] },
      { id: 'f3', label: 'Quantity', type: 'number', required: true, options: [] },
      { id: 'f4', label: 'Needed on site by', type: 'date', required: false, options: [] },
      { id: 'f5', label: 'Urgent', type: 'checkbox', required: false, options: [] },
    ],
    steps: [
      {
        title: 'Collect material requirement from sites', assigneeId: 4, hours: 2,
        how: 'Call the site supervisor, confirm quantity against the BOQ, and take a photo of the current stock.',
        checklist: ['Called site supervisor', 'Quantity checked against BOQ', 'Stock photo taken'],
      },
      {
        title: 'Get 3 vendor quotations', assigneeId: 3, hours: 2,
        how: 'Ask at least 3 approved vendors for rate, GST and delivery date. Save the quotes in the purchase folder.',
        checklist: ['Quote 1 received', 'Quote 2 received', 'Quote 3 received', 'Comparison sheet updated'],
      },
      {
        title: 'Check budget and payment terms', assigneeId: 2, hours: 2,
        how: 'Compare the lowest quote with the site budget. Confirm advance / credit days with the vendor.',
        checklist: ['Within site budget', 'Payment terms confirmed'],
      },
      {
        title: 'Raise purchase order and inform vendor', assigneeId: 3, hours: 1,
        how: 'Create the PO in the purchase register and send it to the vendor on email and WhatsApp.',
        checklist: ['PO created', 'PO sent to vendor', 'Delivery date confirmed with site'],
      },
    ],
  },
  {
    // created from an existing task ("Vendor onboarding documents"); runs only when started
    id: 3, name: 'New vendor onboarding', frequency: 'ON_DEMAND', dayOfWeek: null, startTime: '10:00', endTime: '18:00',
    sourceTaskTitle: 'Vendor onboarding documents',
    description: '',
    formFields: [
      { id: 'f1', label: 'Vendor name', type: 'text', required: true, options: [] },
      { id: 'f2', label: 'Material category', type: 'select', required: true, options: ['Tiles', 'Plywood', 'Hardware', 'Electrical', 'Sanitary'] },
    ],
    steps: [
      { title: 'Collect vendor documents', assigneeId: 3, hours: 4, how: '', checklist: ['GST certificate', 'PAN card', 'Cancelled cheque / bank letter', 'MSME certificate (if any)'] },
      { title: 'Verify documents', assigneeId: 2, hours: 2, how: '', checklist: ['GST number checked on GST portal', 'Bank details match the cheque'] },
      { title: 'Create vendor in accounts', assigneeId: 2, hours: 1, how: '', checklist: ['Vendor code created', 'Vendor master updated'] },
    ],
  },
  {
    id: 2, name: 'Weekly site billing', frequency: 'WEEKLY', dayOfWeek: 'FRIDAY', startTime: '10:00', endTime: '19:00',
    description: '',
    formFields: [
      { id: 'f1', label: 'Site', type: 'select', required: true, options: ['Coca-Cola Pirangut', 'PIL', 'Infosys SDB 7', 'AIGP Kharadi'] },
      { id: 'f2', label: 'Billing period', type: 'text', required: true, options: [] },
    ],
    steps: [
      { title: 'Prepare measurement sheet', assigneeId: 5, hours: 2, how: 'Measure completed work on site and fill the measurement sheet.', checklist: ['Site measurement done', 'Sheet signed by site engineer'] },
      { title: 'Prepare RA bill', assigneeId: 2, hours: 2, how: 'Make the running account bill from the measurement sheet.', checklist: ['Rates checked with work order', 'GST calculated'] },
      { title: 'Send bill to client', assigneeId: 3, hours: 1, how: 'Email the bill with the measurement sheet attached.', checklist: ['Bill emailed', 'Hard copy couriered'] },
    ],
  },
];


/** Fixed-date office holidays (added for this year and next). Admin adds festivals from the Holidays page. */
const FIXED_HOLIDAYS = [
  ['01-26', 'Republic Day'],
  ['05-01', 'Maharashtra Day'],
  ['08-15', 'Independence Day'],
  ['10-02', 'Gandhi Jayanti'],
  ['12-25', 'Christmas'],
];

// How reliable each person is in the generated history (share done on time).
const RELIABILITY = { 2: 0.86, 3: 0.93, 4: 0.74, 5: 0.81 };
const HISTORY_DAYS = 240;

/** Small seeded random generator so the demo data is the same every reset. */
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSeed() {
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const rand = rng(20261026);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const employees = EMPLOYEES.map((e) => ({ ...e, active: true, createdAt: iso(now - 300 * D) }));
  const tasks = [];
  const activity = [];
  const push = (t) => { t.id = tasks.length + 1; tasks.push(t); return t; };
  const act = (taskId, actorId, action, fromStatus, toStatus, comment, at) =>
    activity.push({ id: activity.length + 1, taskId, actorId, action, fromStatus, toStatus, comment: comment || null, createdAt: at });

  // ---- generated history: ~1–2 items per working day, per employee
  const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
  employees.filter((e) => e.role === 'EMPLOYEE').forEach((e) => {
    const titles = WORK_BY_DEPT[e.department] || WORK_BY_DEPT.Projects;
    const reliable = RELIABILITY[e.id] ?? 0.8;
    for (let d = HISTORY_DAYS; d >= -10; d--) {
      const day = new Date(midnight.getTime() - d * D);
      if (day.getDay() === 0) continue; // Sunday off
      const count = rand() < 0.35 ? 2 : rand() < 0.85 ? 1 : 0;
      for (let k = 0; k < count; k++) {
        const due = day.getTime() + (17 + Math.floor(rand() * 3)) * H;
        const created = day.getTime() - Math.floor(rand() * 2) * D + 9.5 * H;
        const selfAdded = rand() < 0.25;
        let status = 'TODO';
        let completedAt = null;
        if (d > 0) {
          // past day
          const r = rand();
          if (r < reliable) {                       // done on time
            status = 'COMPLETED'; completedAt = due - (1 + rand() * 5) * H;
          } else if (r < reliable + 0.08) {         // done late
            status = 'COMPLETED'; completedAt = due + (2 + rand() * 40) * H;
          } else if (d < 14) {                      // recent and still open = overdue
            status = rand() < 0.5 ? 'TODO' : 'IN_PROGRESS';
          } else if (rand() < 0.3) {                // old: a few were cancelled
            status = 'CANCELLED';
          } else {                                  // old: the rest got done late
            status = 'COMPLETED'; completedAt = due + (24 + rand() * 72) * H;
          }
        } else if (d === 0) {
          status = pick(['TODO', 'IN_PROGRESS', 'COMPLETED']);
          if (status === 'COMPLETED') completedAt = Math.min(now - H, day.getTime() + 12 * H);
        }
        if (completedAt && completedAt > now) completedAt = now - H;
        const t = push({
          title: pick(titles), description: '', assigneeId: e.id, createdById: selfAdded ? e.id : 1,
          priority: pick(['LOW', 'MEDIUM', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'URGENT']),
          status, dueAt: iso(due), createdAt: iso(Math.min(created, now)), updatedAt: iso(Math.min(created, now)),
          startedAt: status === 'TODO' ? null : iso(Math.min(created + 2 * H, now)),
          submittedAt: completedAt ? iso(completedAt) : null, completedAt: completedAt ? iso(completedAt) : null,
          recurringTemplateId: null, dueSoonReminded: d > 0, overdueReminded: d > 0,
        });
        act(t.id, t.createdById, 'CREATED', null, 'TODO', selfAdded ? 'Added own work' : null, t.createdAt);
        if (completedAt) act(t.id, e.id, 'STATUS_CHANGED', 'IN_PROGRESS', 'COMPLETED', null, t.completedAt);
      }
    }
  });

  // ---- hand-written current tasks, with richer history
  CURRENT.forEach(([title, a, priority, due, status, created, description, by = 1, reviewerId = null]) => {
    const createdAt = iso(now + created);
    const t = push({
      title, description, assigneeId: a, createdById: by, reviewerId, priority, status,
      dueAt: iso(now + due), createdAt, updatedAt: createdAt,
      startedAt: status === 'TODO' ? null : iso(now + created + 2 * H),
      submittedAt: ['SUBMITTED', 'COMPLETED'].includes(status) ? iso(now + created + D) : null,
      completedAt: null, recurringTemplateId: null, dueSoonReminded: false, overdueReminded: false,
    });
    act(t.id, by, 'CREATED', null, 'TODO', reviewerId ? `Reviewer: ${EMPLOYEES.find((e) => e.id === reviewerId).fullName}` : null, createdAt);
    if (t.startedAt) act(t.id, a, 'STATUS_CHANGED', 'TODO', 'IN_PROGRESS', null, t.startedAt);
    if (t.submittedAt) act(t.id, a, 'STATUS_CHANGED', 'IN_PROGRESS', 'SUBMITTED', 'Done, please check.', t.submittedAt);
    if (status === 'REOPENED') act(t.id, 1, 'STATUS_CHANGED', 'SUBMITTED', 'REOPENED', 'Two bills are missing, please add them.', iso(now - D));
  });

  const recurring = RECURRING.map((r) => ({ createdById: 1, ...r, lastGeneratedOn: null, createdAt: iso(now - 20 * D) }));

  const year = new Date().getFullYear();
  const holidays = [];
  [year, year + 1].forEach((y) => FIXED_HOLIDAYS.forEach(([md, name]) =>
    holidays.push({ id: holidays.length + 1, date: `${y}-${md}`, name, note: '', createdAt: iso(now - 30 * D) })));
  // a sample holiday a few working days from now, so it shows in this week's / month's calendar
  let sample = new Date(midnight.getTime() + 4 * D);
  if (sample.getDay() === 0) sample = new Date(sample.getTime() + D);
  const pad = (n) => String(n).padStart(2, '0');
  holidays.push({ id: holidays.length + 1, date: `${sample.getFullYear()}-${pad(sample.getMonth() + 1)}-${pad(sample.getDate())}`, name: 'Office annual day (sample)', note: 'Office closed. Delete or edit this on the Holidays page.', createdAt: iso(now) });

  const notifications = [
    { id: 1, recipientId: 1, taskId: null, type: 'TASK_SUBMITTED', message: 'Rahul Patil submitted "Collect 3 quotations for plywood" for review', read: false, createdAt: iso(now - 2 * H) },
    { id: 2, recipientId: 3, taskId: null, type: 'TASK_REOPENED', message: 'Sent back for changes: Update purchase register — Two bills are missing, please add them.', read: false, createdAt: iso(now - D) },
  ];
  // link the two sample notifications to their tasks
  notifications[0].taskId = tasks.find((t) => t.title.startsWith('Collect 3 quotations'))?.id ?? null;
  notifications[1].taskId = tasks.find((t) => t.title === 'Update purchase register' && t.status === 'REOPENED')?.id ?? null;

  const workflows = WORKFLOWS.map(({ sourceTaskTitle, ...w }) => ({
    ...w, createdById: 1, active: true, lastRunOn: null, createdAt: iso(now - 15 * D),
    sourceTaskId: sourceTaskTitle ? tasks.find((t) => t.title === sourceTaskTitle)?.id ?? null : null,
    steps: w.steps.map((st) => ({ priority: 'MEDIUM', ...st })),
  }));

  return {
    employees, tasks, activity, recurring, notifications, holidays, digests: {},
    workflows, workflowRuns: [], demoWorkflowProgress: true, demoWorkflowHistory: true,
    // answers used for today's sample run of "Daily purchase cycle"
    demoFormData: { f1: 'Coca-Cola Pirangut', f2: '18 mm BWP plywood', f3: 120, f4: '', f5: true },
  };
}
