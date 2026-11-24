import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import FmsPicker from './FmsPicker.jsx';

const workflows = [
  { id: 1, name: 'Purchase approval', department: 'Purchase', active: true },
  { id: 2, name: 'Vendor payment', department: 'Accounts', active: true },
  { id: 3, name: 'Bill check', department: 'Accounts', active: false },
  { id: 4, name: 'General request', department: null, active: true },
];

function Harness({ onPick = () => {} }) {
  const [value, setValue] = useState('');
  return <FmsPicker workflows={workflows} value={value} onChange={(v) => { setValue(v); onPick(v); }} />;
}

describe('FMS picker', () => {
  it('lists existing FMS grouped by department', () => {
    render(<Harness />);
    const fms = screen.getByRole('combobox', { name: 'Save form data in existing FMS' });
    const groups = [...fms.querySelectorAll('optgroup')].map((g) => g.label);
    expect(groups).toEqual(['Accounts', 'Purchase', 'No department']);
    const accounts = fms.querySelector('optgroup[label="Accounts"]');
    expect([...accounts.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Bill check (Paused)', 'Vendor payment']);
  });

  it('shows only one department after choosing it, and clears an FMS from another department', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const fms = screen.getByRole('combobox', { name: 'Save form data in existing FMS' });
    await user.selectOptions(fms, 'Purchase approval');
    expect(fms).toHaveValue('1');

    await user.selectOptions(screen.getByRole('combobox', { name: 'FMS department' }), 'Accounts (2)');
    expect(fms).toHaveValue('');
    expect(within(fms).queryByRole('option', { name: 'Purchase approval' })).toBeNull();
    expect(within(fms).getByRole('option', { name: 'Vendor payment' })).toBeInTheDocument();
    expect(onPick).toHaveBeenLastCalledWith('');
  });
});
