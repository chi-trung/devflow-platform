import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, Layers, Play } from "lucide-react";
import type { DashboardData } from "../../types/api";

interface StatsCardsProps {
  data: DashboardData;
  className?: string;
}

function share(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function StatsCards({ data, className = "" }: StatsCardsProps) {
  const { t } = useTranslation();
  const inProgress = data.tasksByStatus.InProgress ?? 0;
  const done = data.tasksByStatus.Done ?? 0;
  const overdue = data.overdueCount ?? 0;

  const cards = [
    {
      key: "total",
      label: t("dashboard.totalTasks"),
      value: data.totalTasks,
      sub: t("dashboard.completedPct", { pct: share(done, data.totalTasks) }),
      icon: Layers,
      chip: "bg-primary/10 text-primary",
      valueClass: "text-foreground",
    },
    {
      key: "progress",
      label: t("dashboard.inProgress"),
      value: inProgress,
      sub: t("dashboard.ofTotal", { pct: share(inProgress, data.totalTasks) }),
      icon: Play,
      chip: "bg-sky-400/10 text-sky-400",
      valueClass: "text-sky-400",
    },
    {
      key: "done",
      label: t("dashboard.completed"),
      value: done,
      sub: t("dashboard.ofTotal", { pct: share(done, data.totalTasks) }),
      icon: CheckCircle2,
      chip: "bg-teal-400/10 text-teal-400",
      valueClass: "text-teal-400",
    },
    {
      key: "overdue",
      label: t("dashboard.overdue"),
      value: overdue,
      sub:
        overdue > 0
          ? t("dashboard.needsAttention")
          : share(overdue, data.totalTasks) === "0%" && data.totalTasks > 0
            ? t("dashboard.allOnTrack")
            : t("dashboard.noTasksYet"),
      icon: Clock,
      chip:
        overdue > 0
          ? "bg-destructive/10 text-destructive"
          : "bg-elevated text-muted-foreground",
      valueClass: overdue > 0 ? "text-destructive" : "text-muted-foreground",
    },
  ];

  return (
    <div className={`grid grid-cols-2 gap-3 xl:grid-cols-4 ${className}`}>
      {cards.map(({ key, label, value, sub, icon: Icon, chip, valueClass }) => (
        <div
          key={key}
          className="hover-lift h-28 rounded-xl border border-border bg-card p-4 hover:border-border-strong"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${chip}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
          </div>
          <p className={`mt-2 font-display text-3xl font-semibold ${valueClass}`}>
            {value}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {sub}
          </p>
        </div>
      ))}
    </div>
  );
}
