/**
 * Plain text where web links (http:// or https://) become clickable and open in a new tab.
 * Everything else stays text (no HTML is ever injected), and line breaks are kept.
 */
const URL_PATTERN = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;

export default function LinkedText({ text, className = '' }) {
  const parts = String(text ?? '').split(URL_PATTERN);
  return (
    <span className={`linked-text ${className}`.trim()}>
      {parts.map((part, i) => (i % 2 === 1
        ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
        : part))}
    </span>
  );
}
