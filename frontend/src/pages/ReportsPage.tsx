import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Download, FileJson, FileSpreadsheet, LineChart } from "lucide-react";
import { api, exportTasks, getBurndown, getTeamReport, getVelocity, getCycleLeadTime, getVelocityHistory } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { BurndownChartApi } from "../components/reporting/BurndownChartApi";
import { VelocityChart } from "../components/reporting/VelocityChart";
import { CycleLeadTimeChart } from "../components/reporting/CycleLeadTimeChart";
import { VelocityTrendChart } from "../components/reporting/VelocityTrendChart";
import { TeamReportCards } from "../components/reporting/TeamReportCards";
import type {
  ProjectResponse,
  WorkspaceMemberResponse,
} from "../types/api";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(isoDaysAgo(0));

  const { data: project } = useApi<ProjectResponse>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}`),
    [workspaceId, projectId],
  );

  const { data: members } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const { data: burndown, error: burndownError, loading: burndownLoading } =
    useApi(() => getBurndown(workspaceId, projectId, from, to), [
      workspaceId,
      projectId,
      from,
      to,
    ]);

  const { data: velocity, error: velocityError, loading: velocityLoading } =
    useApi(() => getVelocity(workspaceId, projectId), [workspaceId, projectId]);

  const { data: cycleLead, error: cycleLeadError, loading: cycleLeadLoading } =
    useApi(() => getCycleLeadTime(workspaceId, projectId), [workspaceId, projectId]);

  const { data: velocityHistory, error: velocityHistoryError, loading: velocityHistoryLoading } =
    useApi(() => getVelocityHistory(workspaceId, projectId), [workspaceId, projectId]);

  const { data: team, error: teamError, loading: teamLoading } = useApi(
    () => getTeamReport(workspaceId),
    [workspaceId],
  );

  const rangeError =
    from && to && new Date(from) > new Date(to)
      ? t("reports.startDateAfterEnd")
      : null;

  const { push } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleExport(format: "csv" | "json") {
    setExporting(format);
    try {
      const blob = await exportTasks(workspaceId, projectId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tasks.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      push(
        err instanceof Error ? err.message : t("reports.exportFailed"),
        "error",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-6">
        <Link
          to={`/workspaces/${workspaceId}/projects/${projectId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("board.projects")}
        </Link>

        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {project ? (
                  t("reports.titleWithName", { name: project.name })
                ) : (
                  <Skeleton className="h-8 w-56" />
                )}
              </h1>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("reports.description")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-all duration-200 hover:border-border-strong hover:bg-elevated active:scale-[0.98] disabled:opacity-40"
            >
              <FileSpreadsheet className="size-4" aria-hidden />
              {exporting === "csv" ? "…" : "CSV"}
            </button>
            <button
              type="button"
              onClick={() => void handleExport("json")}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-all duration-200 hover:border-border-strong hover:bg-elevated active:scale-[0.98] disabled:opacity-40"
            >
              <FileJson className="size-4" aria-hidden />
              {exporting === "json" ? "…" : "JSON"}
            </button>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <Download className="size-3" aria-hidden />
              export
            </span>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm transition-colors duration-200 focus-within:border-primary">
            <LineChart className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              aria-label={t("reports.burndownStartDate")}
              className="bg-transparent focus:outline-none"
            />
            <span className="text-muted-foreground">→</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              aria-label={t("reports.burndownEndDate")}
              className="bg-transparent focus:outline-none"
            />
          </label>
        </div>

        {rangeError && (
          <div className="mb-4">
            <ErrorAlert message={rangeError} />
          </div>
        )}

        <div className="flex flex-col gap-4">
          {burndownLoading ? (
            <Skeleton className="h-72" />
          ) : burndownError ? (
            <ErrorAlert message={burndownError} />
          ) : burndown ? (
            <BurndownChartApi data={burndown} />
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {velocityLoading ? (
              <Skeleton className="h-64" />
            ) : velocityError ? (
              <div className="xl:col-span-1">
                <ErrorAlert message={velocityError} />
              </div>
            ) : velocity && velocity.sprints.length === 0 ? (
              <div className="xl:col-span-2">
                <VelocityChart data={velocity} />
              </div>
            ) : velocity ? (
              <VelocityChart data={velocity} />
            ) : null}
          </div>

          {cycleLeadLoading ? (
            <Skeleton className="h-72" />
          ) : cycleLeadError ? (
            <ErrorAlert message={cycleLeadError} />
          ) : cycleLead ? (
            <CycleLeadTimeChart data={cycleLead} />
          ) : null}

          {velocityHistoryLoading ? (
            <Skeleton className="h-72" />
          ) : velocityHistoryError ? (
            <ErrorAlert message={velocityHistoryError} />
          ) : velocityHistory ? (
            <VelocityTrendChart data={velocityHistory} />
          ) : null}

          {teamLoading ? (
            <Skeleton className="h-40" />
          ) : teamError ? (
            <ErrorAlert message={teamError} />
          ) : team ? (
            <TeamReportCards data={team} members={members ?? []} />
          ) : null}

          {!burndownLoading && !velocityLoading && !teamLoading && (
            <p className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
              <BarChart3 className="size-3.5" aria-hidden />
              {t("reports.dataRefresh")}
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
