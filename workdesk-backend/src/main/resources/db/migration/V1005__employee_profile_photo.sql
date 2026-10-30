create table employee_profile_photo (
  employee_id bigint primary key references employee(id) on delete cascade,
  image_data bytea not null
);
