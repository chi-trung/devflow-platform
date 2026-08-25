import { useTranslation } from "react-i18next";
import { Activity, Download } from "lucide-react";
import { useApi } from "../../hooks/useApi";
import { getCycleLeadTime } from "../../lib/api";
import type { CycleLeadTimeResponse } from "../../types/api";
import { Skeleton } from "../ui/Skeleton";

interface DashboardCycleLeadChartProps {
  workspaceId: string;
  projectId: string;
  className?: string;
}

export function DashboardCycleLeadChart({ workspaceId, projectId, className = "" }: DashboardCycleLeadChartProps) {
  const { t } = useTranslation();
  const { data, error, loading } = useApi<CycleLeadTimeResponse>(
    () => (projectId ? getCycleLeadTime(workspaceId, projectId) : Promise.resolve({ cycleTimeP50: 0, cycleTimeP90: 0, leadTimeP50: 0, leadTimeP90: 0, tasks: [] })),
    [workspaceId, projectId],
  );

  if (!projectId) return null;

  function exportCsv() {
    if (!data?.tasks.length) return;
    const header = "Task ID,Title,Cycle Time (days),Lead Time (days)\n";
    const rows = data.tasks
      .map((t) => `${t.taskId},"${t.title.replace(/"/g, '""')}",${formatMetric(t.cycleTimeDays)},${formatMetric(t.leadTimeDays)}`)
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cycle-lead-time-${projectId}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground ${className}`}>
        {t("dashboard.analyticsUnavailable")}
      </div>
    );
  }

  // Metrics are nullable when no task has been completed yet — render a dash
  // instead of crashing on .toFixed().
  const formatMetric = (value: number | null): string =>
    value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(1);

  const cards = [
    {
      key: "cycleP50",
      label: `${t("dashboard.cycleTime")} ${t("dashboard.p50")}`,
      value: formatMetric(data.cycleTimeP50),
      unit: t("dashboard.days"),
      chip: "bg-primary/10 text-primary",
      valueClass: "text-foreground",
    },
    {
      key: "cycleP90",
      label: `${t("dashboard.cycleTime")} ${t("dashboard.p90")}`,
      value: formatMetric(data.cycleTimeP90),
      unit: t("dashboard.days"),
      chip: "bg-primary/10 text-primary",
      valueClass: "text-foreground",
    },
    {
      key: "leadP50",
      label: `${t("dashboard.leadTime")} ${t("dashboard.p50")}`,
      value: formatMetric(data.leadTimeP50),
      unit: t("dashboard.days"),
      chip: "bg-sky-400/10 text-sky-400",
      valueClass: "text-sky-400",
    },
    {
      key: "leadP90",
      label: `${t("dashboard.leadTime")} ${t("dashboard.p90")}`,
      value: formatMetric(data.leadTimeP90),
      unit: t("dashboard.days"),
      chip: "bg-sky-400/10 text-sky-400",
      valueClass: "text-sky-400",
    },
  ];

  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">
          {t("dashboard.cycleLeadTitle")}
        </h3>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:border-border-strong hover:bg-elevated"
        >
          <Download className="size-3.5" aria-hidden />
          {t("dashboard.exportCsv")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ key, label, value, unit, chip, valueClass }) => (
          <div
            key={key}
            className="hover-lift rounded-xl border border-border bg-card p-4 hover:border-border-strong"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {label}
              </span>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                <Activity className="size-3.5" aria-hidden />
              </span>
            </div>
            <p className={`mt-2 font-display text-3xl font-semibold ${valueClass}`}>
              {value}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
