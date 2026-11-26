/** Page buttons: 1 … 4 5 6 … 9 (first, last, and the pages around the current one). */
export function pageNumbers(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((n, k) => { if (k > 0 && n - sorted[k - 1] > 1) out.push(`gap-${n}`); out.push(n); });
  return out;
}

/** The rows of one page. */
export const pageSlice = (items, page, pageSize) => items.slice((page - 1) * pageSize, page * pageSize);
export const pageCount = (total, pageSize) => Math.max(1, Math.ceil(total / pageSize));

/**
 * ‹ Prev 1 2 3 Next › with "Showing 1–5 of 13". Hidden when everything fits on one page.
 * compact: only ‹ 1 / 3 › (for narrow places like a task lane).
 */
export default function Pagination({ page, pageSize, total, onPage, label = 'Pages', compact = false }) {
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  if (compact) {
    return (
      <nav className="pager pager-compact" aria-label={label}>
        <button type="button" className="btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
        <span className="muted small">{from}–{to} of {total}</span>
        <button type="button" className="btn ghost small" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
      </nav>
    );
  }
  return (
    <nav className="pager" aria-label={label}>
      <span className="muted small">Showing {from}–{to} of {total}</span>
      <div className="pager-buttons">
        <button type="button" className="btn ghost small" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹ Prev</button>
        {pageNumbers(page, pages).map((n) => (typeof n === 'string'
          ? <span key={n} className="muted pager-gap">…</span>
          : (
            <button key={n} type="button" className={`btn small ${n === page ? 'primary' : 'ghost'}`}
              aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => onPage(n)}>{n}</button>
          )))}
        <button type="button" className="btn ghost small" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">Next ›</button>
      </div>
    </nav>
  );
}
