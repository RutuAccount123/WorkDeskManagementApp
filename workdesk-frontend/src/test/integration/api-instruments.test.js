import { describe, expect, it } from 'vitest';
import { instrumentService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { AMIT, PRIYA, signIn } from '../helpers.js';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };

describe('instruments tab', () => {
  it('everyone sees the instruments with Sr No, status, owner, location and history count', async () => {
    await asUser(PRIYA);
    const list = await instrumentService.list();
    expect(list.map((i) => i.srNo)).toEqual(list.map((_, n) => n + 1));
    const meter = list.find((i) => i.name === 'Moisture meter');
    expect(meter).toMatchObject({ status: 'IN_USE', location: 'Kharadi', historyCount: 2 });
    expect(meter.holder.fullName).toBe('Sneha Kulkarni');
    const sprayer = list.find((i) => i.name === 'Airless paint sprayer');
    expect(sprayer).toMatchObject({ status: 'FREE', holder: null, location: 'Office store' });
  });

  it('each unit has its own material code; several units count up from the first code', async () => {
    await asUser(PRIYA);
    await expect(instrumentService.add({ name: 'Core cutter', quantity: 2, holderId: 5, location: 'Wakad' }))
      .rejects.toThrow('one by one');
    await expect(instrumentService.add({ name: 'Core cutter', quantity: 0 })).rejects.toThrow('at least 1');
    await expect(instrumentService.add({ name: 'Core cutter', quantity: 101 })).rejects.toThrow('at most 100');
    const first = await instrumentService.add({ name: 'Core cutter', make: 'Hilti', materialCode: ' cc-08 ', quantity: 3 });
    expect(first).toMatchObject({ materialCode: 'CC-08', status: 'FREE' });
    const units = (await instrumentService.list()).filter((i) => i.name === 'Core cutter');
    expect(units.map((u) => u.materialCode)).toEqual(['CC-08', 'CC-09', 'CC-10']);
    expect(units.every((u) => u.make === 'Hilti' && u.status === 'FREE')).toBe(true);
    // a code another unit has is refused (adding or editing), with the next free one
    await expect(instrumentService.add({ name: 'Core cutter', materialCode: 'cc-09' }))
      .rejects.toThrow('Material code CC-09 is already the code of a "Core cutter". Each unit needs its own code; the next free one is CC-11');
    await expect(instrumentService.update(1, { name: 'Moisture meter', materialCode: 'CC-08' })).rejects.toThrow('already the code');
    expect(await instrumentService.update(units[0].id, { name: 'Core cutter', materialCode: 'CC-08' })).toMatchObject({ materialCode: 'CC-08' });
    // the default instruments each have their own code
    expect((await instrumentService.list()).filter((i) => i.name === 'Hammer drill machine').map((i) => i.materialCode))
      .toEqual(['INS-010', 'INS-014', 'INS-015']);
  });

  it('add → give → shift → submit, and the history shows every person from when to when', async () => {
    await asUser(PRIYA);
    await expect(instrumentService.add({ name: '  ' })).rejects.toThrow('instrument name');
    await expect(instrumentService.add({ name: 'Tile cutter', holderId: 5 })).rejects.toThrow('site location');

    const added = await instrumentService.add({ name: 'Tile cutter', make: ' Rubi ', info: '600 mm' });
    expect(added).toMatchObject({ status: 'FREE', location: 'Office store', historyCount: 0, make: 'Rubi' });
    const edited = await instrumentService.update(added.id, { name: 'Tile cutter', make: 'Bosch', info: '600 mm' });
    expect(edited).toMatchObject({ make: 'Bosch', status: 'FREE' });
    await expect(instrumentService.submit(added.id)).rejects.toThrow('already in the office store');

    const given = await instrumentService.give(added.id, { holderId: 5, location: 'Wakad', project: 'Villa 12' });
    expect(given).toMatchObject({ status: 'IN_USE', location: 'Wakad', project: 'Villa 12' });
    expect(given.holder.fullName).toBe('Amit Deshmukh');
    await expect(instrumentService.give(added.id, { holderId: 5, location: 'Wakad', project: 'Villa 12' }))
      .rejects.toThrow('already has this instrument');

    // anyone can shift it (no access rules on this tab)
    await asUser(AMIT);
    const shifted = await instrumentService.give(added.id, { holderId: 4, location: 'Kharadi', project: 'AIGP', note: 'for floor tiles' });
    expect(shifted.holder.fullName).toBe('Sneha Kulkarni');

    const back = await instrumentService.submit(added.id, 'blade worn');
    expect(back).toMatchObject({ status: 'FREE', holder: null, historyCount: 2 });

    const history = await instrumentService.history(added.id);
    expect(history.map((u) => [u.holder.fullName, u.endAction])).toEqual([
      ['Amit Deshmukh', 'SHIFTED'],
      ['Sneha Kulkarni', 'SUBMITTED'],
    ]);
    expect(history[1]).toMatchObject({ location: 'Kharadi', note: 'for floor tiles', endNote: 'blade worn' });
    expect(history.every((u) => u.startedAt && u.endedAt)).toBe(true);
  });
});
