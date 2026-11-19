import { useCallback, useEffect, useState } from 'react';
import { ticketService } from '@/services/index.js';
import RaiseTicketDialog from './RaiseTicketDialog.jsx';
import TicketCard from './TicketCard.jsx';

/** The Tickets panel on a task page: raise a ticket to another person, and see / resolve this task's tickets. */
export default function TaskTickets({ task, canRaise, onChanged }) {
  const [tickets, setTickets] = useState(null);
  const [raising, setRaising] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    ticketService.forTask(task.id).then(setTickets).catch((e) => setError(e.message));
  }, [task.id]);
  useEffect(() => { load(); }, [load]);

  const changed = () => { load(); onChanged?.(); };
  const openCount = (tickets || []).filter((t) => t.status === 'OPEN').length;

  return (
    <section className="panel">
      <div className="perf-head">
        <div>
          <h2 className="section-title">Tickets</h2>
          <p className="muted small">
            {tickets === null ? ' ' : tickets.length === 0 ? 'Stuck? Raise a ticket to ask someone for help.'
              : `${openCount} open · ${tickets.length - openCount} resolved`}
          </p>
        </div>
        {canRaise && <button className="btn primary small" onClick={() => setRaising(true)}>Raise ticket</button>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {tickets?.length > 0 && (
        <ul className="ticket-list">
          {tickets.map((t) => <TicketCard key={t.id} ticket={t} onChanged={changed} />)}
        </ul>
      )}
      {raising && (
        <RaiseTicketDialog task={task} onClose={() => setRaising(false)} onRaised={() => { setRaising(false); changed(); }} />
      )}
    </section>
  );
}
