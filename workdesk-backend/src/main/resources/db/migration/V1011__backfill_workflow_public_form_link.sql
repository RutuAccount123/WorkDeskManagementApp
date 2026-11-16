-- Every FMS created before shareable form links existed gets its link now.
-- gen_random_uuid() is built into PostgreSQL 13+ and uses a secure random source;
-- two UUIDs without dashes = 64 hard-to-guess characters (fits varchar(64)).
update workflow
   set public_form_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
 where public_form_token is null;
