import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ticketService } from '@/services/index.js';
import { useAuth } from '@/features/auth/AuthContext.jsx';
import TicketCard from './TicketCard.jsx';

const SCOPES = [
  { key: 'assigned', label: 'Assigned to me' },
  { key: 'raised', label: 'Raised by me' },
  { key: 'all', label: 'All tickets', adminOnly: true },
];
const STATUSES = [
  { key: 'OPEN', label: 'Open' },
  { key: 'RESOLVED', label: 'Done' },
  { key: '', label: 'All' },
];

/** Every ticket I need to answer, every ticket I raised, and (admins) every ticket. */
export default function TicketsPage() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const scope = params.get('scope') || 'assigned';
  const status = params.has('status') ? params.get('status') : 'OPEN';
  const focusId = Number(params.get('ticket')) || null;   // opened from a ticket's task: show that ticket
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    ticketService.list({ scope, status }).then(setTickets).catch((e) => { setError(e.message); setTickets([]); });
  }, [scope, status]);
  useEffect(() => { setTickets(null); load(); }, [load]);

  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Tickets</h1>
          <p className="muted">Raise a ticket from any task page when you need help from someone else.</p>
        </div>
      </header>

      <div className="scope-tabs" role="tablist" aria-label="Whose tickets">
        {SCOPES.filter((s) => isAdmin || !s.adminOnly).map((s) => (
          <button key={s.key} role="tab" aria-selected={scope === s.key} className={scope === s.key ? 'on' : ''}
            onClick={() => setParam('scope', s.key, 'assigned')}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="filters">
        <div className="segmented" role="tablist" aria-label="Ticket status">
          {STATUSES.map((s) => (
            <button key={s.key || 'all'} role="tab" aria-selected={status === s.key} className={status === s.key ? 'on' : ''}
              onClick={() => setParam('status', s.key, 'OPEN')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {tickets === null ? <p className="muted">Loading…</p>
        : tickets.length === 0 ? (
          <div className="empty">
            {scope === 'assigned' ? 'No tickets waiting for you.' : scope === 'raised' ? 'You have not raised any tickets here.' : 'No tickets here.'}
          </div>
        ) : (
          <ul className="ticket-list">
            {tickets.map((t) => <TicketCard key={t.id} ticket={t} showTask onChanged={load} focus={t.id === focusId} />)}
          </ul>
        )}
    </div>
  );
}
