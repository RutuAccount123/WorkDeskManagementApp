import { useEffect, useState } from 'react';
import { taskService } from '@/services/index.js';
import { fmtDateTime } from '@/utils/format.js';
import Modal from '@/components/ui/Modal.jsx';
import { fileSize } from './ProofFilePicker.jsx';

const isImage = (a) => a.contentType?.startsWith('image/') && a.contentType !== 'image/heic';

/** "Proof of work" on the task page: photos / files attached when the task was marked done or submitted. */
export default function TaskProofs({ taskId, refreshKey }) {
  const [list, setList] = useState([]);
  const [images, setImages] = useState({});   // id → Base64, for thumbnails
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    taskService.attachments(taskId).then(async (found) => {
      if (!live) return;
      setList(found);
      const loaded = await Promise.all(found.filter(isImage)
        .map((a) => taskService.attachment(taskId, a.id).then((full) => [a.id, full.data]).catch(() => null)));
      if (live) setImages(Object.fromEntries(loaded.filter(Boolean)));
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [taskId, refreshKey]);

  if (!list.length && !error) return null;

  const open = async (a) => {
    setError('');
    try {
      const full = await taskService.attachment(taskId, a.id);
      const bytes = Uint8Array.from(atob(full.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: full.contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = full.fileName;
      link.target = '_blank';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <section className="panel">
      <h2 className="section-title">Proof of work</h2>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="proof-list">
        {list.map((a) => (
          <li key={a.id} className="proof-item">
            {isImage(a) && images[a.id] ? (
              <button type="button" className="proof-thumb" onClick={() => setViewing(a)} aria-label={`View ${a.fileName}`}>
                <img src={`data:${a.contentType};base64,${images[a.id]}`} alt={a.fileName} />
              </button>
            ) : (
              <span className="proof-icon" aria-hidden="true">{a.contentType === 'application/pdf' ? 'PDF' : 'FILE'}</span>
            )}
            <div className="proof-meta">
              <strong>{a.fileName}</strong>
              <small className="muted">{fileSize(a.sizeBytes)} · {a.uploadedByName} · {fmtDateTime(a.createdAt)}</small>
            </div>
            <button type="button" className="btn ghost small" onClick={() => open(a)}>Download</button>
          </li>
        ))}
      </ul>
      {viewing && images[viewing.id] && (
        <Modal title={viewing.fileName} onClose={() => setViewing(null)}>
          <img className="task-attachment-preview" src={`data:${viewing.contentType};base64,${images[viewing.id]}`} alt={viewing.fileName} />
        </Modal>
      )}
    </section>
  );
}
