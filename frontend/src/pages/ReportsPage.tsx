import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowLeft,
  CalendarRange,
  Download,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
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

type ReportTab = "charts" | "team" | "export";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [tab, setTab] = useState<ReportTab>("charts");
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

  // Charts data loads with the page (the charts tab is the default); team data
  // only feeds the team tab, so it's fetched lazily when that tab opens.
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
    () => (tab === "team" ? getTeamReport(workspaceId) : Promise.resolve(undefined)),
    [workspaceId, tab],
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

  const tabs: { id: ReportTab; label: string; aria: string }[] = [
    { id: "charts", label: t("reports.tabCharts"), aria: t("reports.chartsTabAria") },
    { id: "team", label: t("reports.tabTeam"), aria: t("reports.teamTabAria") },
    { id: "export", label: t("reports.tabExport"), aria: t("reports.exportTabAria") },
  ];

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

        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {project ? (
                t("reports.titleWithName", { name: project.name })
              ) : (
                <Skeleton className="h-8 w-56" />
              )}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("reports.description")}
            </p>
          </div>

          {tab === "charts" && (
            <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm transition-colors duration-200 focus-within:border-primary">
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
          )}
        </div>

        <div
          role="tablist"
          aria-label={t("reports.title")}
          className="mb-4 flex gap-1 border-b border-border"
        >
          {tabs.map(({ id, label, aria }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-label={aria}
              onClick={() => setTab(id)}
              className={`-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors duration-150 ${
                tab === id
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {rangeError && (
          <div className="mb-4">
            <ErrorAlert message={rangeError} />
          </div>
        )}

        {tab === "charts" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              {burndownLoading ? (
                <Skeleton className="h-72" />
              ) : burndownError ? (
                <ErrorAlert message={burndownError} />
              ) : burndown ? (
                <BurndownChartApi data={burndown} />
              ) : null}
            </div>

            <div>
              {velocityLoading ? (
                <Skeleton className="h-64" />
              ) : velocityError ? (
                <ErrorAlert message={velocityError} />
              ) : velocity ? (
                <VelocityChart data={velocity} />
              ) : null}
            </div>

            <div>
              {velocityHistoryLoading ? (
                <Skeleton className="h-64" />
              ) : velocityHistoryError ? (
                <ErrorAlert message={velocityHistoryError} />
              ) : velocityHistory ? (
                <VelocityTrendChart data={velocityHistory} />
              ) : null}
            </div>

            <div className="lg:col-span-2">
              {cycleLeadLoading ? (
                <Skeleton className="h-72" />
              ) : cycleLeadError ? (
                <ErrorAlert message={cycleLeadError} />
              ) : cycleLead ? (
                <CycleLeadTimeChart data={cycleLead} />
              ) : null}
            </div>
          </div>
        )}

        {tab === "team" && (
          <div className="flex flex-col gap-4">
            {teamLoading ? (
              <Skeleton className="h-40" />
            ) : teamError ? (
              <ErrorAlert message={teamError} />
            ) : team ? (
              <TeamReportCards data={team} members={members ?? []} />
            ) : null}
          </div>
        )}

        {tab === "export" && (
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Download className="size-4" aria-hidden />
              </span>
              <div>
                <h3 className="font-display text-sm font-semibold">
                  {t("reports.export")}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("reports.exportDescription")}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleExport("csv")}
                disabled={exporting !== null}
                className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <FileSpreadsheet className="size-4" aria-hidden />
                </span>
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-sm font-semibold">CSV</span>
                  <ArrowDownToLine
                    className={`size-3.5 text-muted-foreground transition-opacity duration-150 ${
                      exporting === "csv" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    aria-hidden
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("reports.exportCsvDesc")}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleExport("json")}
                disabled={exporting !== null}
                className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500">
                  <FileJson className="size-4" aria-hidden />
                </span>
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-sm font-semibold">JSON</span>
                  <ArrowDownToLine
                    className={`size-3.5 text-muted-foreground transition-opacity duration-150 ${
                      exporting === "json" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                    aria-hidden
                  />
                </span>
                <span className="text-xs text-muted-foreground">
                  {t("reports.exportJsonDesc")}
                </span>
              </button>
            </div>

            <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              {t("reports.exportRangeHint")}
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
