alter table task add column image_data bytea;
alter table recurring_template add column image_data bytea;
alter table recurring_template add column reviewer_id bigint references employee(id);
