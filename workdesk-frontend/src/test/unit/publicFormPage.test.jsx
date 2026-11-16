import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicFormPage from '@/features/public-form/PublicFormPage.jsx';
import { workflowService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, signIn } from '../helpers.js';

const openForm = (linkPart) => render(
  <MemoryRouter initialEntries={[`/f/${linkPart}`]}>
    <Routes><Route path="/f/:token" element={<PublicFormPage />} /></Routes>
  </MemoryRouter>,
);

describe('public FMS form page (Google Form style)', () => {
  it('shows a header card and one card per question, and records the response', async () => {
    tokenStore.clear();
    await signIn(ADMIN);
    const wf = await workflowService.create({
      name: 'Site enquiry', description: 'Tell us about your site', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
      formFields: [
        { label: 'Customer', type: 'text', required: true },
        { label: 'Site', type: 'select', required: true, options: 'PIL, AIGP' },
        { label: 'Urgent', type: 'checkbox', required: false },
      ],
      steps: [{ title: 'Call back', assigneeId: 3, hours: 1 }, { title: 'Send quote', assigneeId: 2, hours: 2 }],
    });
    tokenStore.clear(); // the visitor is not signed in

    openForm(`site-enquiry-${wf.publicFormToken}`);
    expect(await screen.findByRole('heading', { name: 'Site enquiry' })).toBeInTheDocument();
    expect(screen.getByText('Tell us about your site')).toBeInTheDocument();
    expect(screen.getByText(/Indicates required question/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: /Your name/ }), { target: { value: 'Mr. Shah' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Customer/ }), { target: { value: 'Mr. Shah' } });
    const site = screen.getByRole('group', { name: /Site/ });
    fireEvent.click(within(site).getByRole('radio', { name: 'AIGP' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Your response has been recorded.')).toBeInTheDocument();
    await signIn(ADMIN);
    const [row] = await workflowService.tracker(wf.id);
    expect(row.formData).toMatchObject({ f1: 'Mr. Shah', f2: 'AIGP', f3: false });
    expect(row.formFilledByName).toBe('Mr. Shah');
  });

  it('asks a signed-in member for their name too', async () => {
    tokenStore.clear();
    await signIn(ADMIN);
    const wf = await workflowService.create({
      name: 'Quick check', description: '', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
      formFields: [{ label: 'Note', type: 'text', required: false }],
      steps: [{ title: 'Call back', assigneeId: 3, hours: 1 }, { title: 'Send quote', assigneeId: 2, hours: 2 }],
    });
    openForm(wf.publicFormToken);
    const name = await screen.findByRole('textbox', { name: /Your name/ });
    expect(name).toHaveValue('');
    expect(name).toBeRequired();
    expect(screen.queryByText(/Filling as/)).toBeNull();
  });

  it('explains when the link is not valid', async () => {
    openForm('some-form-NOTACODE00');
    expect(await screen.findByRole('heading', { name: 'Form not available' })).toBeInTheDocument();
  });
});
