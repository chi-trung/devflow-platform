import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}

const pageButton =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40";

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
  className = "",
}: PaginationProps) {
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(pageCount, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const rangeFrom = total !== undefined && pageSize ? (page - 1) * pageSize + 1 : null;
  const rangeTo =
    total !== undefined && pageSize ? Math.min(total, page * pageSize) : null;

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-between gap-4 ${className}`}
    >
      {rangeFrom !== null && rangeTo !== null && total !== undefined ? (
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {rangeFrom}&ndash;{rangeTo}
          </span>{" "}
          of <span className="font-medium text-foreground">{total}</span> tasks
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`${pageButton} border border-border text-muted-foreground hover:border-border-strong hover:text-foreground`}
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>

        {start > 1 && (
          <>
            <button
              type="button"
              className={`${pageButton} text-muted-foreground hover:bg-elevated hover:text-foreground`}
              onClick={() => onChange(1)}
            >
              1
            </button>
            {start > 2 && (
              <span className="px-1 text-sm text-muted-foreground" aria-hidden>
                &hellip;
              </span>
            )}
          </>
        )}

        {pages.map((p) =>
          p === page ? (
            <span
              key={p}
              aria-current="page"
              className={`${pageButton} bg-primary font-semibold text-on-primary`}
            >
              {p}
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`${pageButton} text-muted-foreground hover:bg-elevated hover:text-foreground`}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          ),
        )}

        {end < pageCount && (
          <>
            {end < pageCount - 1 && (
              <span className="px-1 text-sm text-muted-foreground" aria-hidden>
                &hellip;
              </span>
            )}
            <button
              type="button"
              className={`${pageButton} text-muted-foreground hover:bg-elevated hover:text-foreground`}
              onClick={() => onChange(pageCount)}
            >
              {pageCount}
            </button>
          </>
        )}

        <button
          type="button"
          className={`${pageButton} border border-border text-muted-foreground hover:border-border-strong hover:text-foreground`}
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
