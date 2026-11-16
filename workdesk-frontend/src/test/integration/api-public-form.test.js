import { describe, expect, it } from 'vitest';
import { formLinkUrl, publicFormService, taskService, workflowService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, RAHUL, SNEHA, signIn } from '../helpers.js';
import { filledByText } from '@/features/workflows/FmsTaskSheet.jsx';

const asUser = async (email) => { tokenStore.clear(); return signIn(email); };
const flow = () => ({
  name: 'Site enquiry', description: 'A customer sends an enquiry', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
  formFields: [{ label: 'Customer', type: 'text', required: true }, { label: 'Site', type: 'select', required: false, options: 'PIL, AIGP' }],
  steps: [{ title: 'Call back', assigneeId: 3, hours: 1 }, { title: 'Send quote', assigneeId: 2, hours: 2 }],
});

describe('FMS shareable form link', () => {
  it('is created with the FMS, opens without sign-in, and each entry starts a new run', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    expect(wf.publicFormToken).toMatch(/^[A-Za-z0-9]{10}$/);

    tokenStore.clear(); // a visitor who is not signed in
    const form = await publicFormService.get(wf.publicFormToken);
    expect(form).toEqual({ name: 'Site enquiry', description: 'A customer sends an enquiry', formFields: wf.formFields, signedInAs: null });
    expect(form.createdBy).toBeUndefined(); // no internal details leak
    expect(form.signedInAs).toBeNull();
    await expect(publicFormService.submit(wf.publicFormToken, { f1: 'Mr. Shah' }, '  ')).rejects.toThrow('Please enter your name');
    await expect(publicFormService.submit(wf.publicFormToken, {}, 'Mr. Shah')).rejects.toThrow(/Customer/);
    await publicFormService.submit(wf.publicFormToken, { f1: 'Mr. Shah', f2: 'PIL' }, ' Mr. Shah ');

    await asUser(ADMIN);
    const rows = await workflowService.tracker(wf.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].formData).toMatchObject({ f1: 'Mr. Shah', f2: 'PIL' });
    expect(rows[0].steps[0].task.status).toBe('IN_PROGRESS');
    // the visitor is recorded, not the FMS owner
    expect(rows[0].formFilledBy).toBeNull();
    expect(rows[0].formFilledByName).toBe('Mr. Shah');
  });

  it('"Filled by" is the name typed on the form, even for a signed-in member, whose "Fill the form" task is closed', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    const link = formLinkUrl(wf.publicFormToken, wf.name);
    const fillTask = await taskService.create({
      title: 'Fill the form: Site enquiry', description: `Please fill this form: Site enquiry\n${link}`,
      assigneeId: 4, noReview: true, priority: 'MEDIUM',
    });
    const otherTask = await taskService.create({ title: 'Unrelated', description: 'https://example.com/f/x-OTHERCODE1', assigneeId: 4, noReview: true });

    const sneha = await asUser(SNEHA);
    const linkPart = link.split('/f/')[1];
    expect((await publicFormService.get(linkPart)).signedInAs).toBe(sneha.fullName);
    await expect(publicFormService.submit(linkPart, { f1: 'Mr. Rao' })).rejects.toThrow('Please enter your name');
    await publicFormService.submit(linkPart, { f1: 'Mr. Rao' }, 'Site supervisor Kiran');

    expect((await taskService.get(fillTask.id)).status).toBe('COMPLETED');
    expect((await taskService.get(otherTask.id)).status).toBe('TODO');

    await asUser(ADMIN);
    const [row] = await workflowService.tracker(wf.id);
    expect(row.formFilledByName).toBe('Site supervisor Kiran'); // what the sheet shows, not the signed-in name
    expect(filledByText(row)).toBe('Site supervisor Kiran');
  });

  it('gives a short link with the FMS name in it, which keeps working after a rename', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    const url = formLinkUrl(wf.publicFormToken, 'Site Enquiry (Pune)');
    expect(url).toBe(`${window.location.origin}/f/site-enquiry-pune-${wf.publicFormToken}`);
    expect(formLinkUrl(wf.publicFormToken, 'साइट')).toBe(`${window.location.origin}/f/${wf.publicFormToken}`);

    tokenStore.clear();
    const linkPart = url.split('/f/')[1];
    await expect(publicFormService.get(linkPart)).resolves.toMatchObject({ name: 'Site enquiry' });
    await expect(publicFormService.get(`old-name-${wf.publicFormToken}`)).resolves.toMatchObject({ name: 'Site enquiry' });
    await expect(publicFormService.get(`site-enquiry-WRONGCODE1`)).rejects.toMatchObject({ status: 404 });
  });

  it('FMS that existed before form links also have a working link', async () => {
    await asUser(ADMIN);
    const existing = await workflowService.list();
    expect(existing.length).toBeGreaterThan(0);
    existing.forEach((wf) => expect(wf.publicFormToken).toBeTruthy());
    tokenStore.clear();
    await expect(publicFormService.get(existing[0].publicFormToken)).resolves.toMatchObject({ name: existing[0].name });
  });

  it('stops working when turned off, replaced, or the FMS is paused', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    const old = wf.publicFormToken;

    const renewed = await workflowService.newFormLink(wf.id);
    expect(renewed.publicFormToken).not.toBe(old);
    await expect(publicFormService.get(old)).rejects.toMatchObject({ status: 404 });

    await workflowService.setActive(wf.id, false);
    await expect(publicFormService.get(renewed.publicFormToken)).rejects.toThrow('closed');
    await workflowService.setActive(wf.id, true);

    const off = await workflowService.turnOffFormLink(wf.id);
    expect(off.publicFormToken).toBeNull();
    await expect(publicFormService.get(renewed.publicFormToken)).rejects.toMatchObject({ status: 404 });
  });

  it('only the owner or an admin can change the link', async () => {
    await asUser(ADMIN);
    const wf = await workflowService.create(flow());
    await asUser(RAHUL); // has a step in it, but did not set it up
    await expect(workflowService.newFormLink(wf.id)).rejects.toMatchObject({ status: 403 });
    await expect(workflowService.turnOffFormLink(wf.id)).rejects.toMatchObject({ status: 403 });
  });
});
