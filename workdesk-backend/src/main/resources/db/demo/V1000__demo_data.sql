-- =====================================================================
--  SAMPLE DATA for trying the app (dev profile only — never on a real server).
--  Everyone's password: Employee@123
-- =====================================================================
create extension if not exists pgcrypto;   -- only for hashing the sample passwords below

-- the sample admin (password Admin@123)
insert into employee (employee_code, full_name, email, password_hash, role, department, designation)
select 'ADM-001', 'System Admin', 'admin@company.com', crypt('Admin@123', gen_salt('bf', 10)), 'ADMIN', 'Management', 'Administrator'
where not exists (select 1 from employee where email = 'admin@company.com');

insert into employee (employee_code, full_name, email, password_hash, role, department, designation, phone) values
  ('EMP-101', 'Priya Sharma',   'priya@company.com', crypt('Employee@123', gen_salt('bf', 10)), 'EMPLOYEE', 'Accounts', 'Accounts Executive', '9800000002'),
  ('EMP-102', 'Rahul Patil',    'rahul@company.com', crypt('Employee@123', gen_salt('bf', 10)), 'EMPLOYEE', 'Purchase', 'Purchase Officer',   '9800000003'),
  ('EMP-103', 'Sneha Kulkarni', 'sneha@company.com', crypt('Employee@123', gen_salt('bf', 10)), 'EMPLOYEE', 'Projects', 'Site Coordinator',   '9800000004'),
  ('EMP-104', 'Amit Deshmukh',  'amit@company.com',  crypt('Employee@123', gen_salt('bf', 10)), 'EMPLOYEE', 'Projects', 'Site Supervisor',    '9800000005');

insert into holiday (holiday_date, name, note) values
  ('2026-08-15', 'Independence Day', 'Office closed'),
  ('2026-10-02', 'Gandhi Jayanti', 'Office closed'),
  ('2026-12-25', 'Christmas', 'Office closed'),
  ('2027-01-26', 'Republic Day', 'Office closed');

-- [title, assignee, priority, due from now, status, created from now, details, assigned by, reviewer]
with p as (select id, email from employee),
d (title, assignee, priority, due, status, created, details, by_email, reviewer) as (values
  ('Prepare GST summary for October', 'priya', 'HIGH', interval '-20 hours', 'TODO', interval '-4 days', 'Compile GSTR-1 and GSTR-3B figures from the sales register.', 'admin', 'admin'),
  ('Material balance check, Pirangut site', 'sneha', 'URGENT', interval '-3 hours', 'IN_PROGRESS', interval '-2 days', 'Count cement, tiles and plywood on site and match with the material tracker.', 'admin', 'admin'),
  ('Collect 3 quotations for plywood', 'rahul', 'URGENT', interval '4 hours', 'SUBMITTED', interval '-3 days', '18 mm BWP plywood, 120 sheets. Need 3 vendor quotes with delivery time.', 'admin', 'admin'),
  ('Reconcile vendor payments', 'priya', 'HIGH', interval '6 hours', 'IN_PROGRESS', interval '-3 days', 'Check every vendor statement against the purchase register and flag mismatches.', 'admin', 'admin'),
  ('Update purchase register', 'rahul', 'LOW', interval '3 days', 'REOPENED', interval '-5 days', 'Add last week’s bills to the master purchase register.', 'admin', 'admin'),
  ('Vendor onboarding documents', 'rahul', 'MEDIUM', interval '12 days', 'TODO', interval '-1 days', 'Collect GST certificate, PAN and bank details from the two new vendors.', 'admin', 'admin'),
  ('Labour attendance sheet, Kharadi', 'amit', 'MEDIUM', interval '1 day', 'TODO', interval '-1 days', '', 'admin', 'admin'),
  ('Share site measurement for tile quantity', 'sneha', 'HIGH', interval '5 hours', 'SUBMITTED', interval '-1 days', 'Rahul needs the measurement sheet to order tiles.', 'rahul', 'rahul'),
  ('Verify vendor bill for plywood order', 'priya', 'MEDIUM', interval '1 day', 'IN_PROGRESS', interval '-1 days', 'Match the bill with the PO and GRN.', 'rahul', 'rahul'),
  ('Send labour count for payroll', 'amit', 'MEDIUM', interval '2 days', 'TODO', interval '-2 hours', '', 'priya', 'priya'),
  ('Prepare material request for next week', 'amit', 'HIGH', interval '8 hours', 'SUBMITTED', interval '-2 days', 'Sneha assigned this; Rahul (Purchase) checks it.', 'sneha', 'rahul')
)
insert into task (title, description, assignee_id, created_by_id, reviewer_id, priority, status, due_at, created_at, updated_at,
                  started_at, submitted_at)
select d.title, d.details, a.id, b.id, r.id, d.priority, d.status, now() + d.due, now() + d.created, now() + d.created,
       case when d.status <> 'TODO' then now() + d.created + interval '2 hours' end,
       case when d.status = 'SUBMITTED' then now() - interval '1 hour' end
from d
join p a on a.email = d.assignee || '@company.com'
join p b on b.email = d.by_email || '@company.com'
join p r on r.email = d.reviewer || '@company.com';

insert into task_activity (task_id, actor_id, action, to_status, comment, created_at)
select id, created_by_id, 'CREATED', 'TODO', null, created_at from task;

insert into recurring_template (title, description, assignee_id, created_by_id, priority, frequency, day_of_week, due_time, active)
select v.title, v.descr, a.id, c.id, v.priority, v.freq, v.dow, v.due::time, v.active
from (values
  ('Daily site progress report', 'Share today’s progress, manpower and material used.', 'sneha', 'admin', 'MEDIUM', 'DAILY', null, '19:00', true),
  ('Weekly purchase summary', '', 'rahul', 'admin', 'MEDIUM', 'WEEKLY', 'MONDAY', '17:00', true),
  ('Petrol expense submission', '', 'amit', 'admin', 'LOW', 'WEEKLY', 'SATURDAY', '13:00', false),
  ('Check bank balance and update cash book', '', 'priya', 'priya', 'MEDIUM', 'DAILY', null, '11:00', true)
) v(title, descr, assignee, by_email, priority, freq, dow, due, active)
join employee a on a.email = v.assignee || '@company.com'
join employee c on c.email = v.by_email || '@company.com';

insert into workflow (name, description, frequency, start_time, end_time, created_by_id, form_fields, steps)
select 'Daily purchase cycle', 'Site needs → quotations → budget check → purchase order, the same day.', 'DAILY', '10:00', '19:00',
  (select id from employee where email = 'admin@company.com'),
  '[{"id":"f1","label":"Site","type":"select","required":true,"options":["Coca-Cola Pirangut","PIL","Infosys SDB 7","AIGP Kharadi"]},
    {"id":"f2","label":"Material required","type":"text","required":true,"options":[]},
    {"id":"f3","label":"Quantity","type":"number","required":true,"options":[]},
    {"id":"f4","label":"Needed on site by","type":"date","required":false,"options":[]},
    {"id":"f5","label":"Urgent","type":"checkbox","required":false,"options":[]}]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('title', 'Collect material requirement from sites', 'assigneeId', (select id from employee where email = 'sneha@company.com'), 'hours', 2, 'priority', 'MEDIUM',
      'how', 'Call the site supervisor, confirm quantity against the BOQ, and take a photo of the current stock.',
      'checklist', jsonb_build_array('Called site supervisor', 'Quantity checked against BOQ', 'Stock photo taken')),
    jsonb_build_object('title', 'Get 3 vendor quotations', 'assigneeId', (select id from employee where email = 'rahul@company.com'), 'hours', 2, 'priority', 'MEDIUM',
      'how', 'Ask at least 3 approved vendors for rate, GST and delivery date. Save the quotes in the purchase folder.',
      'checklist', jsonb_build_array('Quote 1 received', 'Quote 2 received', 'Quote 3 received', 'Comparison sheet updated')),
    jsonb_build_object('title', 'Check budget and payment terms', 'assigneeId', (select id from employee where email = 'priya@company.com'), 'hours', 2, 'priority', 'MEDIUM',
      'how', 'Compare the lowest quote with the site budget. Confirm advance / credit days with the vendor.',
      'checklist', jsonb_build_array('Within site budget', 'Payment terms confirmed')),
    jsonb_build_object('title', 'Raise purchase order and inform vendor', 'assigneeId', (select id from employee where email = 'rahul@company.com'), 'hours', 1, 'priority', 'HIGH',
      'how', 'Create the PO in the purchase register and send it to the vendor on email and WhatsApp.',
      'checklist', jsonb_build_array('PO created', 'PO sent to vendor', 'Delivery date confirmed with site'))
  );
