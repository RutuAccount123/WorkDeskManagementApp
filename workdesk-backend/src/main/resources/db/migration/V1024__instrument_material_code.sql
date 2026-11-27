-- Instruments tab: a material can have many units (e.g. 4 hammer drills). Units with the same material code are one
-- material: the first page lists materials with their quantity; opening one shows each unit.

alter table instrument add column material_code varchar(40) not null default '';

-- codes for the default instruments (only where still empty)
update instrument set material_code = v.code
from (values
  ('Moisture meter', 'INS-001'),
  ('Laser distance meter', 'INS-002'),
  ('Cross line laser level', 'INS-003'),
  ('Auto level machine', 'INS-004'),
  ('Airless paint sprayer', 'INS-005'),
  ('Paint and putty mixer', 'INS-006'),
  ('PU injection pump', 'INS-007'),
  ('Gas torch for membrane', 'INS-008'),
  ('Coating thickness gauge (DFT)', 'INS-009'),
  ('Hammer drill machine', 'INS-010'),
  ('Angle grinder', 'INS-011'),
  ('Wet and dry vacuum cleaner', 'INS-012'),
  ('Aluminium ladder (8 ft)', 'INS-013')
) as v(name, code)
where instrument.name = v.name and instrument.material_code = '';

create index instrument_material_code on instrument (upper(material_code));
