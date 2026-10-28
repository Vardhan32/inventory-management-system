import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.pages <= 1) return null;

  const start = (meta.page - 1) * meta.per_page + 1;
  const end = Math.min(meta.page * meta.per_page, meta.total);

  return (
    <div className="pagination">
      <span>
        Showing {start}–{end} of {meta.total}
      </span>
      <div className="pagination__buttons">
        <button
          type="button"
          className="icon-btn"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="pagination__page">
          {meta.page} / {meta.pages}
        </span>
        <button
          type="button"
          className="icon-btn"
          disabled={meta.page >= meta.pages}
          onClick={() => onPageChange(meta.page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
