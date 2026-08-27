import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Users, ExternalLink } from "lucide-react";
import { api } from "../../lib/api";
import { Skeleton } from "../ui/Skeleton";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { TeamReportResponse } from "../../types/api";

interface TeamReportPanelProps {
  workspaceId: string;
  /** When provided, the "View reports" link points at that project's reports
   *  page (the route requires a project segment — `/workspaces/:id/reports`
   *  alone 404s). When absent the link is hidden. */
  projectId?: string;
  className?: string;
}

function TrendChip({ value, suffix }: { value: number; suffix: string }) {
  const positive = value > 0;
  const neutral = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${
        neutral
          ? "bg-elevated text-muted-foreground"
          : positive
            ? "bg-emerald-500/10 text-emerald-500"
            : "bg-red-500/10 text-red-500"
      }`}
    >
      {neutral ? (
        "—"
      ) : positive ? (
        <TrendingUp className="size-3" aria-hidden />
      ) : (
        <TrendingDown className="size-3" aria-hidden />
      )}
      {neutral ? "" : `${positive ? "+" : ""}${value.toFixed(1)}`}
      {suffix}
    </span>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TeamReportPanel({ workspaceId, projectId, className = "" }: TeamReportPanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<TeamReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<TeamReportResponse>(`/workspaces/${workspaceId}/reporting/team`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(t("dashboard.teamReportLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [workspaceId, t]);

  if (loading) {
    return (
      <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
        {error ? <ErrorAlert message={error} /> : (
          <div className="text-center text-sm text-muted-foreground py-6">
            {t("dashboard.teamReportUnavailable")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Users className="size-4 text-primary" aria-hidden />
          {t("dashboard.teamReport")}
        </h3>
        <div className="flex items-center gap-2">
          {data.trends && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("dashboard.velocityDelta")}</span>
              <TrendChip value={data.trends.completedDelta} suffix={t("dashboard.tasksSuffix")} />
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-surface px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{t("dashboard.totalMembers")}</p>
          <p className="mt-0.5 font-display text-lg font-semibold">{data.members.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{t("dashboard.totalCompleted")}</p>
          <p className="mt-0.5 font-display text-lg font-semibold">{data.totalCompleted}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-surface px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{t("dashboard.totalTime")}</p>
          <p className="mt-0.5 font-display text-lg font-semibold">{formatMinutes(data.totalMinutesLogged)}</p>
        </div>
      </div>

      {/* Per-member table */}
      {data.members.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-surface">
                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">{t("dashboard.member")}</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">{t("dashboard.completed")}</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">{t("dashboard.inProgress")}</th>
                <th className="px-3 py-2 text-right text-[11px] font-medium text-muted-foreground">{t("dashboard.time")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {data.members.map((member) => (
                <tr key={member.userId} className="transition-colors hover:bg-elevated">
                  <td className="px-3 py-2 font-medium">{member.userName}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{member.tasksCompleted}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{member.inProgressCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{formatMinutes(member.totalMinutesLogged)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {projectId && (
        <div className="mt-3 text-center">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}/reports`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:underline"
          >
            {t("dashboard.viewReports")}
            <ExternalLink className="size-3" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
