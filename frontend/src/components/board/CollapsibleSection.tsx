import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  /** Small hint text shown next to the title (e.g. a count or summary). */
  hint?: ReactNode;
  /** Section body. Rendered lazily only while expanded. */
  children: ReactNode;
  /** Open on first render — used for sections that usually matter. */
  defaultOpen?: boolean;
}

/**
 * Collapsible wrapper for the secondary TaskDetailPanel sections (DoD,
 * dependencies, subtasks, custom fields, time tracking, PRs…). Keeps the
 * panel's main column scannable: description + comments stay visible, the
 * rest collapse into one-line rows. Body renders lazily so collapsed
 * sections never fire their data fetches.
 */
export function CollapsibleSection({
  title,
  hint,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-elevated/60 rounded-xl"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        {hint}
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {/* Rendered only when open: collapsed sections stay cheap (no fetches). */}
      {open && (
        <div className="border-t border-border px-3.5 py-3">{children}</div>
      )}
    </section>
  );
}
