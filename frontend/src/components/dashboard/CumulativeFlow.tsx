import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import type { DashboardData } from "../../types/api";

interface CumulativeFlowProps {
  data: DashboardData;
  className?: string;
}

const STATUS_ORDER = ["Backlog", "InProgress", "InReview", "Done"] as const;

const STATUS_COLORS: Record<string, string> = {
  Backlog: "var(--color-border-strong, #64748b)",
  InProgress: "var(--color-primary)",
  InReview: "var(--color-warning, #f59e0b)",
  Done: "var(--color-success, #10b981)",
};

export function CumulativeFlow({ data, className = "" }: CumulativeFlowProps) {
  const { t } = useTranslation();

  const counts = STATUS_ORDER.map((status) => data.tasksByStatus[status] ?? 0);
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        {t("dashboard.noTasksYet")}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <h3 className="mb-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold">
        <Layers className="size-4 text-primary" aria-hidden />
        {t("dashboard.cfd")}
      </h3>

      {/* Stacked horizontal bar = cumulative flow snapshot */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border/60">
        {counts.map((count, index) =>
          count === 0 ? null : (
            <div
              key={STATUS_ORDER[index]}
              style={{
                width: `${(count / total) * 100}%`,
                backgroundColor: STATUS_COLORS[STATUS_ORDER[index]],
              }}
              title={`${t(`taskStatus.${STATUS_ORDER[index]}`)}: ${count}`}
              aria-label={`${t(`taskStatus.${STATUS_ORDER[index]}`)}: ${count}`}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap transition-all duration-300"
            >
              <span className="px-1 font-mono text-[10px] font-semibold text-white/90">
                {count}
              </span>
            </div>
          ),
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {STATUS_ORDER.map((status) => {
          const count = data.tasksByStatus[status] ?? 0;
          return (
            <span
              key={status}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: STATUS_COLORS[status] }}
                aria-hidden
              />
              {t(`taskStatus.${status}`)}
              <span className="font-mono text-[11px]">{count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
