-- Instruments tab: repair units that were saved with another material's code (e.g. a new "Moisture meter" saved
-- with INS-002, the laser distance meter's code, so it showed under the laser distance meter).
-- Such a unit gets back the code of the first instrument with its own name. From now on the server refuses this.

update instrument i
set material_code = own.material_code
from (
  select distinct on (lower(btrim(name))) lower(btrim(name)) as lname, material_code
  from instrument
  where material_code <> ''
  order by lower(btrim(name)), id
) own
where lower(btrim(i.name)) = own.lname
  and upper(i.material_code) <> upper(own.material_code)
  and exists (
    select 1 from instrument o
    where upper(o.material_code) = upper(i.material_code)
      and lower(btrim(o.name)) <> lower(btrim(i.name))
      and o.id < i.id
  );
