alter table employee
  add column department_admin boolean not null default false;

alter table employee
  add constraint employee_department_admin_scope_ck
  check (not department_admin or (role = 'ADMIN' and department is not null));
