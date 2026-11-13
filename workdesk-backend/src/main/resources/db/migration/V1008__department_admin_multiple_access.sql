create table employee_department_access (
  employee_id bigint not null references employee(id) on delete cascade,
  department varchar(80) not null,
  primary key (employee_id, department)
);

insert into employee_department_access (employee_id, department)
select id, department
from employee
where department_admin = true and department is not null;
