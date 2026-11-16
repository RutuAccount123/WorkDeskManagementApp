-- Shareable form link for an FMS: anyone with the link can fill the FMS entry form,
-- and each submission starts a new run. Null = link turned off.
alter table workflow add column public_form_token varchar(64);
create unique index ux_workflow_public_form_token on workflow (public_form_token);
