import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AuthProvider } from '@/features/auth/AuthContext.jsx';
import StartRunDialog from '@/features/workflows/StartRunDialog.jsx';
import { filledByText } from '@/features/workflows/FmsTaskSheet.jsx';
import { workflowService } from '@/services/index.js';
import { tokenStore } from '@/services/http.js';
import { ADMIN, signIn } from '../helpers.js';

describe('Start new dialog', () => {
  it('uses the form cards, takes "Filled by" from the signed-in person and asks no name', async () => {
    tokenStore.clear();
    const me = await signIn(ADMIN);
    const wf = await workflowService.create({
      name: 'Bill approval', description: 'Vendor bill received', frequency: 'ON_DEMAND', startTime: '10:00', endTime: '18:00',
      formFields: [{ label: 'Vendor', type: 'text', required: true }, { label: 'Site', type: 'select', required: false, options: 'PIL, AIGP' }],
      steps: [{ title: 'Check bill', assigneeId: 3, hours: 1 }, { title: 'Approve payment', assigneeId: 2, hours: 2 }],
    });
    let started = null;
    render(
      <AuthProvider>
        <StartRunDialog workflow={wf} onClose={() => {}} onStarted={(run) => { started = run; }} />
      </AuthProvider>,
    );

    expect(await screen.findByText(me.fullName)).toBeInTheDocument();
    expect(screen.getByText(/Filled by:/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Your name/ })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: /Vendor/ }), { target: { value: 'Acme' } });
    fireEvent.click(within(screen.getByRole('group', { name: /Site/ })).getByRole('radio', { name: 'PIL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start workflow' }));

    await waitFor(() => expect(started).not.toBeNull());
    expect(started.formData).toMatchObject({ f1: 'Acme', f2: 'PIL' });
    expect(started.formFilledBy).toMatchObject({ id: me.id });
    expect(filledByText(started)).toBe(me.fullName);
  });
});
