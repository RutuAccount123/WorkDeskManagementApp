import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Pages call this with the id of the task the person clicked.
 * It opens the full task page (/tasks/:id); the browser Back button returns to the list.
 */
export default function TaskPanel({ openId, onClose }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!openId) return;
    onClose?.();
    navigate(`/tasks/${openId}`);
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
