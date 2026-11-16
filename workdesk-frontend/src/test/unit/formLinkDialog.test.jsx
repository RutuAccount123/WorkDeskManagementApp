import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthContext.jsx';
import FormLinkDialog, { shareMessage, whatsappUrl } from '@/features/workflows/FormLinkDialog.jsx';
import LinkedText from '@/components/ui/LinkedText.jsx';
import { formLinkUrl, taskService, workflowService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, PRIYA, RAHUL, signIn } from '../helpers.js';

const flow = {
  name: 'Site enquiry', description: '', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
  formFields: [{ label: 'Customer', type: 'text', required: true }],
  steps: [{ title: 'Call back', assigneeId: 3, hours: 1 }, { title: 'Send quote', assigneeId: 2, hours: 2 }],
};

const openDialog = (wf) => render(
  <AuthProvider>
    <FormLinkDialog workflow={wf} canManage onClose={() => {}} onChanged={() => {}} />
  </AuthProvider>,
);

describe('Form link dialog: share and assign', () => {
  it('shares the link on WhatsApp with the FMS name in the message', async () => {
    tokenStore.clear();
    await signIn(ADMIN);
    const wf = await workflowService.create(flow);
    openDialog(wf);
    const url = formLinkUrl(wf.publicFormToken, wf.name);
    const wa = await screen.findByRole('link', { name: /Share on WhatsApp/ });
    expect(wa).toHaveAttribute('href', whatsappUrl(shareMessage(wf.name, url)));
    expect(wa.getAttribute('href')).toContain(encodeURIComponent(url));
    expect(wa).toHaveAttribute('target', '_blank');
  });

  it('assigns a "fill the form" task with the link to the chosen members', async () => {
    tokenStore.clear();
    await signIn(ADMIN);
    const wf = await workflowService.create(flow);
    openDialog(wf);

    fireEvent.click(await screen.findByRole('checkbox', { name: /Rahul/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Priya/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign to 2 people' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Task assigned to'));

    const url = formLinkUrl(wf.publicFormToken, wf.name);
    for (const who of [RAHUL, PRIYA]) {
      tokenStore.clear();
      await signIn(who);
      const mine = (await taskService.list({ scope: 'assigned' })).find((t) => t.title === 'Fill the form: Site enquiry');
      expect(mine).toBeTruthy();
      expect(mine.description).toContain(url);
      expect(mine.reviewer ?? null).toBeNull(); // no review: they close it after filling the form
    }
  });

  it('assigns to a single member too', async () => {
    tokenStore.clear();
    await signIn(ADMIN);
    const wf = await workflowService.create(flow);
    openDialog(wf);
    fireEvent.click(await screen.findByRole('checkbox', { name: /Rahul/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Assign task' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Task assigned to Rahul Patil.'));
  });
});

describe('LinkedText', () => {
  it('makes web links clickable and leaves the rest as text', () => {
    render(<p><LinkedText text={'Please fill this form: X\nhttps://desk.example.com/f/x-AbC123defG.'} /></p>);
    const a = screen.getByRole('link');
    expect(a).toHaveAttribute('href', 'https://desk.example.com/f/x-AbC123defG');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('never turns other text into links', () => {
    render(<p><LinkedText text={'javascript:alert(1) <b>hi</b>'} /></p>);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
