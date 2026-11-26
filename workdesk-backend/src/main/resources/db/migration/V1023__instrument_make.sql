-- Instruments tab: "Make" (the company / brand, e.g. Bosch, Graco) instead of the weight.

alter table instrument add column make varchar(120) not null default '';

-- the default instruments get their usual make (only where it is still empty)
update instrument set make = v.make
from (values
  ('Moisture meter', 'Protimeter'),
  ('Laser distance meter', 'Bosch'),
  ('Cross line laser level', 'Bosch'),
  ('Auto level machine', 'Sokkia'),
  ('Airless paint sprayer', 'Graco'),
  ('Paint and putty mixer', 'Bosch'),
  ('PU injection pump', 'Sika'),
  ('Gas torch for membrane', 'Sievert'),
  ('Coating thickness gauge (DFT)', 'Elcometer'),
  ('Hammer drill machine', 'Bosch'),
  ('Angle grinder', 'Makita'),
  ('Wet and dry vacuum cleaner', 'Karcher'),
  ('Aluminium ladder (8 ft)', 'Youngman')
) as v(name, make)
where instrument.name = v.name and instrument.make = '';

alter table instrument drop column weight_kg;
