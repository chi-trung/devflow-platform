import { useRef, useState } from "react";
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
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { BurndownChartApi } from "../components/reporting/BurndownChartApi";
import { VelocityChart } from "../components/reporting/VelocityChart";
import { CycleLeadTimeChart } from "../components/reporting/CycleLeadTimeChart";
import { VelocityTrendChart } from "../components/reporting/VelocityTrendChart";
import { TeamReportCards } from "../components/reporting/TeamReportCards";
import type {
  ProjectResponse,
  TeamReportResponse,
  WorkspaceMemberResponse,
} from "../types/api";

type ReportTab = "charts" | "team" | "export";

// Every report section shares one failure affordance: the server message plus a
// retry wired to the reload its own useApi already exposed. Before this, an
// errored chart had no way to recover short of changing the date range or
// reloading the page.
function ReportError({
  id,
  message,
  onRetry,
}: {
  id: string;
  message: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ErrorAlert id={id} message={message} />
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

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

  // Fail-closed convention (waves 2-8): error !== null && data === null means
  // "failed with nothing cached" - the only shape that justifies a fallback
  // render. Dropping `error` here left the h1 skeleton stuck forever on a
  // failed project load, and a failed members list silently degraded the team
  // table to fallback names with no way to recover.
  const { data: project, error: projectError, reload: reloadProject } =
    useApi<ProjectResponse>(
      () => api(`/workspaces/${workspaceId}/projects/${projectId}`),
      [workspaceId, projectId],
    );
  const projectFailed = projectError !== null && project === null;

  const { data: members, error: membersError, reload: reloadMembers } =
    useApi<WorkspaceMemberResponse[]>(
      () => api(`/workspaces/${workspaceId}/members`),
      [workspaceId],
    );
  const membersFailed = membersError !== null && members === null;

  const {
    data: burndown,
    error: burndownError,
    loading: burndownLoading,
    reload: reloadBurndown,
  } = useApi(() => getBurndown(workspaceId, projectId, from, to), [
    workspaceId,
    projectId,
    from,
    to,
  ]);

  const { data: velocity, error: velocityError, loading: velocityLoading, reload: reloadVelocity } =
    useApi(() => getVelocity(workspaceId, projectId), [workspaceId, projectId]);

  const {
    data: cycleLead,
    error: cycleLeadError,
    loading: cycleLeadLoading,
    reload: reloadCycleLead,
  } = useApi(() => getCycleLeadTime(workspaceId, projectId), [workspaceId, projectId]);

  const {
    data: velocityHistory,
    error: velocityHistoryError,
    loading: velocityHistoryLoading,
    reload: reloadVelocityHistory,
  } = useApi(() => getVelocityHistory(workspaceId, projectId), [workspaceId, projectId]);

  // Charts data loads with the page (the charts tab is the default); team data
  // only feeds the team tab, so it's fetched lazily when that tab opens. The
  // off-tab stub resolves null (not undefined) on purpose: null is the hook's
  // "nothing cached" sentinel, so a team fetch that fails after a tab switch
  // still reads as failed rather than slipping past the === null gate.
  const { data: team, error: teamError, loading: teamLoading, reload: reloadTeam } =
    useApi<TeamReportResponse | null>(
      () => (tab === "team" ? getTeamReport(workspaceId) : Promise.resolve(null)),
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

  // Tablist keyboard support per WAI-ARIA authoring practice: Left/Right move
  // between tabs (activation follows focus), Home/End jump to the ends.
  const tabRefs = useRef<Partial<Record<ReportTab, HTMLButtonElement | null>>>({});
  function onTabListKeyDown(event: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    const id = tabs[next].id;
    setTab(id);
    tabRefs.current[id]?.focus();
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

        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {project ? (
                t("reports.titleWithName", { name: project.name })
              ) : projectFailed ? (
                // A failed load must not keep the shimmer spinning forever:
                // fall back to the generic (true) title so the page never
                // claims a project name it does not have.
                t("reports.title")
              ) : (
                <Skeleton className="h-8 w-56" />
              )}
            </h1>
            {projectFailed && projectError && (
              <div className="mt-2">
                <ReportError
                  id="reports-project-error"
                  message={projectError}
                  onRetry={reloadProject}
                />
              </div>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("reports.description")}
            </p>
          </div>

          {tab === "charts" && (
            // Two native date inputs measure ~250px together; on a 320px phone
            // that is wider than the flex row, so cap the label and let the
            // inputs shrink inside it instead of forcing a sideways scroll.
            <label className="flex w-full max-w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm transition-colors duration-200 focus-within:border-primary sm:w-auto">
              <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
                aria-label={t("reports.burndownStartDate")}
                className="w-0 min-w-0 flex-1 bg-transparent focus:outline-none"
              />
              <span className="shrink-0 text-muted-foreground">→</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
                aria-label={t("reports.burndownEndDate")}
                className="w-0 min-w-0 flex-1 bg-transparent focus:outline-none"
              />
            </label>
          )}
        </div>

        <div
          role="tablist"
          aria-label={t("reports.title")}
          className="mb-4 flex gap-1 border-b border-border"
        >
          {tabs.map(({ id, label, aria }, index) => (
            // panels are conditionally mounted; an inactive tab must not
            // aria-controls an id that isn't in the DOM.
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`reports-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={tab === id ? `reports-panel-${id}` : undefined}
              onKeyDown={(event) => onTabListKeyDown(event, index)}
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
          <div
            role="tabpanel"
            id={`reports-panel-${tab}`}
            aria-labelledby={`reports-tab-${tab}`}
            tabIndex={0}
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          >
            <div className="lg:col-span-2">
              {burndownLoading ? (
                <Skeleton className="h-72" />
              ) : burndownError ? (
                <ReportError id="reports-burndown-error" message={burndownError} onRetry={reloadBurndown} />
              ) : burndown ? (
                <BurndownChartApi data={burndown} />
              ) : null}
            </div>

            <div>
              {velocityLoading ? (
                <Skeleton className="h-64" />
              ) : velocityError ? (
                <ReportError id="reports-velocity-error" message={velocityError} onRetry={reloadVelocity} />
              ) : velocity ? (
                <VelocityChart data={velocity} />
              ) : null}
            </div>

            <div>
              {velocityHistoryLoading ? (
                <Skeleton className="h-64" />
              ) : velocityHistoryError ? (
                <ReportError
                  id="reports-velocity-history-error"
                  message={velocityHistoryError}
                  onRetry={reloadVelocityHistory}
                />
              ) : velocityHistory ? (
                <VelocityTrendChart data={velocityHistory} />
              ) : null}
            </div>

            <div className="lg:col-span-2">
              {cycleLeadLoading ? (
                <Skeleton className="h-72" />
              ) : cycleLeadError ? (
                <ReportError id="reports-cycle-lead-error" message={cycleLeadError} onRetry={reloadCycleLead} />
              ) : cycleLead ? (
                <CycleLeadTimeChart data={cycleLead} />
              ) : null}
            </div>
          </div>
        )}

        {tab === "team" && (
          <div
            role="tabpanel"
            id={`reports-panel-${tab}`}
            aria-labelledby={`reports-tab-${tab}`}
            tabIndex={0}
            className="flex flex-col gap-4"
          >
            {teamLoading ? (
              <Skeleton className="h-40" />
            ) : teamError ? (
              <ReportError id="reports-team-error" message={teamError} onRetry={reloadTeam} />
            ) : team ? (
              <>
                {membersFailed && membersError && (
                  <ReportError
                    id="reports-members-error"
                    message={membersError}
                    onRetry={reloadMembers}
                  />
                )}
                <TeamReportCards data={team} members={members ?? []} />
              </>
            ) : null}
          </div>
        )}

        {tab === "export" && (
          <div
            role="tabpanel"
            id={`reports-panel-${tab}`}
            aria-labelledby={`reports-tab-${tab}`}
            tabIndex={0}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
                <Download className="size-4" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">
                  {t("reports.export")}
                </h2>
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
