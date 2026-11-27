-- Instruments tab: the material code is each unit's own code (units with the same NAME are one material).
-- Listed units that share a code with an older listed unit get the next free INS-### code (after the highest INS code).
-- From now on the server refuses a code another listed unit already has.

with top as (
  select coalesce(max(substring(material_code from '^INS-(\d+)$')::int), 0) as n
  from instrument
),
dup as (
  select i.id, row_number() over (order by i.id) as rn
  from instrument i
  where i.removed_at is null
    and i.material_code <> ''
    and exists (
      select 1 from instrument o
      where o.removed_at is null and upper(o.material_code) = upper(i.material_code) and o.id < i.id
    )
)
update instrument
set material_code = 'INS-' || lpad((top.n + dup.rn)::text, 3, '0')
from dup, top
where instrument.id = dup.id;
