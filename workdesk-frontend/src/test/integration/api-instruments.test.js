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

  it('add → give → shift → submit, and the history shows every person from when to when', async () => {
    await asUser(PRIYA);
    await expect(instrumentService.add({ name: '  ' })).rejects.toThrow('instrument name');
    await expect(instrumentService.add({ name: 'Tile cutter', holderId: 5 })).rejects.toThrow('site location');

    const added = await instrumentService.add({ name: 'Tile cutter', weightKg: 3.2, info: '600 mm' });
    expect(added).toMatchObject({ status: 'FREE', location: 'Office store', historyCount: 0, weightKg: 3.2 });
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
