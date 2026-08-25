import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Timer, Flame } from "lucide-react";
import { api } from "../../lib/api";
import { Skeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import type { SprintResponse, BurndownResponse } from "../../types/api";

interface SprintHealthCardProps {
  workspaceId: string;
  projectId: string;
  className?: string;
}

export function SprintHealthCard({ workspaceId, projectId, className = "" }: SprintHealthCardProps) {
  const { t } = useTranslation();
  const [sprint, setSprint] = useState<SprintResponse | null>(null);
  const [burndown, setBurndown] = useState<BurndownResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api<SprintResponse[]>(`/workspaces/${workspaceId}/projects/${projectId}/sprints`)
      .then((sprints) => {
        if (cancelled) return;
        const active = sprints.find((s) => s.status === "Active");
        setSprint(active ?? null);
        if (active && active.startDateUtc && active.endDateUtc) {
          return api<BurndownResponse>(
            `/workspaces/${workspaceId}/projects/${projectId}/reporting/burndown?startDate=${active.startDateUtc}&endDate=${active.endDateUtc}`,
          );
        }
      })
      .then((bd) => {
        if (!cancelled && bd) setBurndown(bd);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId, projectId]);

  if (loading) {
    return <Skeleton className={`h-24 ${className}`} />;
  }

  if (!sprint) {
    return (
      <div className={className}>
        <EmptyState
          icon={<Timer className="size-8 text-muted-foreground/40" aria-hidden />}
          title={t("dashboard.noActiveSprint")}
          description={t("dashboard.noActiveSprintDesc")}
        />
      </div>
    );
  }

  const totalPoints = burndown?.totalTasks ?? 0;
  const lastPoint = burndown?.points?.[burndown.points.length - 1];
  const remaining = lastPoint?.remainingTasks ?? 0;
  const completed = totalPoints > 0 ? totalPoints - remaining : 0;
  const pct = totalPoints > 0 ? Math.round((completed / totalPoints) * 100) : 0;

  const now = Date.now();
  const endMs = sprint.endDateUtc ? new Date(sprint.endDateUtc).getTime() : 0;
  const startMs = sprint.startDateUtc ? new Date(sprint.startDateUtc).getTime() : 0;
  const daysLeft = endMs > now ? Math.ceil((endMs - now) / 86_400_000) : 0;
  const totalDays = endMs > startMs ? Math.ceil((endMs - startMs) / 86_400_000) : 1;
  const daysElapsed = Math.max(0, totalDays - daysLeft);

  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Flame className="size-4 text-primary" aria-hidden />
          {t("dashboard.sprintHealth")}
        </h3>
        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{sprint.name}</span>
      </div>

      <div className="mb-3 flex items-end gap-3">
        <div>
          <p className="font-display text-3xl font-bold">{pct}%</p>
          <p className="text-xs text-muted-foreground">{t("dashboard.completed")}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-mono text-sm font-semibold">{daysLeft}d</p>
          <p className="text-xs text-muted-foreground">{t("dashboard.remaining")}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{completed}/{totalPoints} {t("dashboard.tasksSuffix")}</span>
        <span>{daysElapsed}/{totalDays} {t("dashboard.days")}</span>
      </div>
    </div>
  );
}
