import { readFileBase64 } from '@/utils/image.js';

export const MAX_PROOF_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip';

export const fileSize = (bytes) => (bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Chosen files → what the server takes as proof of work. */
export const toAttachments = (files) => Promise.all(files.map(async (f) => ({
  fileName: f.name, contentType: f.type || null, data: await readFileBase64(f),
})));

/**
 * "Attach proof of work" under the Notes box: photos or files sent together with Mark done / Submit.
 * files / onChange hold the chosen File objects; onError shows a message.
 */
export default function ProofFilePicker({ files, onChange, onError, disabled }) {
  const add = (e) => {
    const chosen = [...(e.target.files || [])];
    e.target.value = '';
    const tooBig = chosen.find((f) => f.size > MAX_BYTES);
    if (tooBig) { onError(`“${tooBig.name}” is larger than 5 MB.`); return; }
    if (files.length + chosen.length > MAX_PROOF_FILES) onError(`You can attach up to ${MAX_PROOF_FILES} files.`);
    else onError('');
    onChange([...files, ...chosen].slice(0, MAX_PROOF_FILES));
  };

  return (
    <div className="proof-picker">
      <label className="proof-picker-label">Attach proof of work (optional)
        <input type="file" multiple accept={ACCEPT} onChange={add} disabled={disabled || files.length >= MAX_PROOF_FILES} />
      </label>
      <p className="muted small">Photo or file (PDF, Word, Excel…), up to {MAX_PROOF_FILES} files, 5 MB each. Sent when you press Mark done / Submit.</p>
      {files.length > 0 && (
        <ul className="proof-chosen">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <span>{f.name} <small className="muted">{fileSize(f.size)}</small></span>
              <button type="button" className="link-btn" aria-label={`Remove ${f.name}`} disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
