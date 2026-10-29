import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StatusChip from '@/components/ui/StatusChip.jsx';
import StatusSteps from '@/components/ui/StatusSteps.jsx';
import Modal from '@/components/ui/Modal.jsx';
import DynamicForm, { FormAnswers } from '@/components/form/DynamicForm.jsx';
import { STATUS_LABEL } from '@/utils/format.js';

describe('StatusChip', () => {
  it.each(Object.entries(STATUS_LABEL))('shows %s as "%s"', (status, label) => {
    render(<StatusChip status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it('shows Overdue for late open work, not for done work', () => {
    const { rerender } = render(<StatusChip status="TODO" overdue />);
    expect(screen.getByText('Overdue')).toHaveClass('chip-late');
    rerender(<StatusChip status="COMPLETED" overdue />);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});

describe('StatusSteps', () => {
  it('uses the same words as the chips', () => {
    render(<StatusSteps status="IN_PROGRESS" />);
    ['To do', 'In progress', 'Waiting for review', 'Done'].forEach((w) => expect(screen.getByText(w)).toBeInTheDocument());
    expect(screen.getByRole('img')).toHaveAccessibleName('Status: In progress');
  });
  it('shows Sent back on the first step when reopened', () => {
    render(<StatusSteps status="REOPENED" />);
    expect(screen.getByText('Sent back')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('closes with Escape and the × button', () => {
    const onClose = vi.fn();
    render(<Modal title="Assign a task" onClose={onClose}><p>Body</p></Modal>);
    expect(screen.getByRole('dialog', { name: 'Assign a task' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('DynamicForm', () => {
  const fields = [
    { id: 'f1', label: 'Site', type: 'select', required: true, options: ['PIL', 'AIGP'] },
    { id: 'f2', label: 'Qty', type: 'number', required: false, options: [] },
    { id: 'f3', label: 'Urgent', type: 'checkbox', required: false, options: [] },
  ];
  it('reports every change with all values', () => {
    const onChange = vi.fn();
    render(<DynamicForm fields={fields} values={{ f2: 3 }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Site/), { target: { value: 'PIL' } });
    expect(onChange).toHaveBeenLastCalledWith({ f2: 3, f1: 'PIL' });
    fireEvent.click(screen.getByLabelText('Urgent'));
    expect(onChange).toHaveBeenLastCalledWith({ f2: 3, f3: true });
  });
  it('FormAnswers shows Yes/No and dashes', () => {
    render(<FormAnswers fields={fields} values={{ f1: 'PIL', f2: '', f3: true }} />);
    expect(screen.getByText('PIL')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});
