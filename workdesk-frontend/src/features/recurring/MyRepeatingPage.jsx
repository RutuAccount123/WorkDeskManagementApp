import { useState } from 'react';
import RepeatingTaskList from '@/features/my-work/RepeatingTaskList.jsx';

/**
 * Employees: the daily / weekly tasks they do or set up. They can't change them;
 * "Ask admin to stop" raises a ticket to an admin.
 */
export default function MyRepeatingPage() {
  const [refresh, setRefresh] = useState(0);
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Repeating tasks</h1>
          <p className="muted">Daily and weekly tasks you do or set up. To stop one, ask an admin with a ticket.</p>
        </div>
      </header>
      <RepeatingTaskList refreshKey={refresh} onChanged={() => setRefresh((n) => n + 1)} />
    </div>
  );
}
