import { describe, expect, it } from 'vitest';
import { codeTaken, codesFrom, groupMaterials, nextCode, nextFreeCodeFor } from './InstrumentsPage.jsx';

const unit = (id, name, materialCode = '') => ({ id, name, materialCode, make: '', info: '', status: 'FREE' });

describe('groupMaterials: units with the same name are one material, each with its own code', () => {
  it('groups by name, in the order first added; codes do not decide the group', () => {
    const m = groupMaterials([unit(1, 'Hammer drill', 'HD-01'), unit(2, 'Ladder', 'LD-01'), unit(3, ' hammer  DRILL ', 'HD-02')]);
    expect(m.map((x) => [x.name, x.units.map((u) => u.id)])).toEqual([['Hammer drill', [1, 3]], ['Ladder', [2]]]);
  });

  it('a unit whose code looks like another material\'s stays with its own name', () => {
    // (what went wrong before: a moisture meter saved with INS-002 showed under the laser distance meter)
    const m = groupMaterials([unit(1, 'Moisture meter', 'INS-001'), unit(2, 'Laser distance meter', 'INS-002'),
      unit(18, 'Moisture meter', 'INS-015')]);
    expect(m[0].units.map((u) => u.id)).toEqual([1, 18]);
    expect(m[1].units.map((u) => u.id)).toEqual([2]);
  });
});

describe('material codes', () => {
  const units = [unit(1, 'Hammer drill', 'HD-01'), unit(2, 'Hammer drill', 'HD-02'), unit(3, 'Ladder', 'HD-04')];

  it('nextCode counts up the number at the end and keeps its zeros', () => {
    expect(nextCode('INS-009')).toBe('INS-010');
    expect(nextCode('HD-99')).toBe('HD-100');
    expect(nextCode('LADDER')).toBe('LADDER-2');
  });

  it('several units get codes counting up from the first, skipping used ones', () => {
    expect(codesFrom(units, 'hd-03', 3)).toEqual(['HD-03', 'HD-05', 'HD-06']);
  });

  it('"add more" suggests the next free code after the material\'s highest code', () => {
    const [drills] = groupMaterials(units);
    expect(nextFreeCodeFor(units, drills)).toBe('HD-03');
  });

  it('a code another unit has is refused with the next free one; its own code is fine when editing', () => {
    expect(codeTaken(units, 'hd-02')).toMatch(/HD-02 is already the code of a “Hammer drill”.*next free one is HD-03/);
    expect(codeTaken(units, 'HD-02', 2)).toBeNull();
    expect(codeTaken(units, 'HD-09')).toBeNull();
    expect(codeTaken(units, '')).toBeNull();
  });
});
