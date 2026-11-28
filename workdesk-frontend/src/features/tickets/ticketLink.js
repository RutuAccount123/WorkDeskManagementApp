import { useNavigate } from 'react-router-dom';

/** The Tickets page, showing this ticket (all statuses, so a resolved one is still found). */
export const ticketPath = (ticketId) => `/tickets?status=&ticket=${ticketId}`;

/**
 * Opening a task from a list: a task that is a ticket raised to me opens on the Tickets page
 * (where "Work on this ticket" is), every other task opens as usual with onOpen(id).
 */
export function useOpenTask(onOpen) {
  const navigate = useNavigate();
  return (t) => (t?.fromTicket?.ticketId ? navigate(ticketPath(t.fromTicket.ticketId)) : onOpen?.(t.id));
}
