-- Shorter form links: "/f/fms-name-CODE" with a 10-character letters/digits code.
-- Long codes made earlier are replaced (a link shared with an old long code stops working).
-- Each character uses the first byte of a fresh gen_random_uuid() (secure random, built into PostgreSQL 13+).
-- "where w.id is not null" ties the sub-select to each row, so every FMS gets its own code.
update workflow w
   set public_form_token = (
        select string_agg(
                 substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
                        get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0) % 62 + 1, 1), '')
          from generate_series(1, 10)
         where w.id is not null)
 where length(w.public_form_token) > 10;
