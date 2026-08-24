import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Activity, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Skeleton } from "../components/ui/Skeleton";
import { getActivities, type GetActivitiesFilters } from "../lib/api";
import type { ActivityResponse, ActivityResponsePage, WorkspaceMemberResponse } from "../types/api";
import { api } from "../lib/api";

const ACTION_OPTIONS = [
  "created task",
  "updated task",
  "deleted task",
  "commented on task",
  "removed comment from task",
  "created subtask",
  "detached subtask",
  "created epic",
  "updated epic",
  "deleted epic",
  "attached file",
  "removed attachment",
  "estimated task",
  "started sprint",
  "completed sprint",
  "created sprint",
  "scheduled task into sprint",
  "pulled task back to backlog",
];

function groupByDate(items: ActivityResponse[]): Map<string, ActivityResponse[]> {
  const groups = new Map<string, ActivityResponse[]>();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.createdAtUtc);
    const dateStr = d.toDateString();
    let label: string;
    if (dateStr === today) label = "today";
    else if (dateStr === yesterday) label = "yesterday";
    else
      label = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(d);

    const existing = groups.get(label) ?? [];
    existing.push(item);
    groups.set(label, existing);
  }
  return groups;
}

export function ActivitiesPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const [pageData, setPageData] = useState<ActivityResponsePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberResponse[]>([]);

  // Filters
  const [actorFilter, setActorFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const PAGE_SIZE = 25;

  // Load members for actor dropdown
  useEffect(() => {
    if (!workspaceId) return;
    api<WorkspaceMemberResponse[]>(`/workspaces/${workspaceId}/members`)
      .then(setMembers)
      .catch(() => {});
  }, [workspaceId]);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: GetActivitiesFilters = {
        page: currentPage,
        pageSize: PAGE_SIZE,
      };
      if (actorFilter) filters.actorUserId = actorFilter;
      if (actionFilter) filters.action = actionFilter;
      if (dateFrom) filters.from = new Date(dateFrom + "T00:00:00Z").toISOString();
      if (dateTo) filters.to = new Date(dateTo + "T23:59:59Z").toISOString();

      const data = await getActivities(workspaceId, projectId, filters);
      setPageData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("activity.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId, currentPage, actorFilter, actionFilter, dateFrom, dateTo, t]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  function resetFilters() {
    setActorFilter("");
    setActionFilter("");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  const hasActiveFilters = actorFilter || actionFilter || dateFrom || dateTo;
  const totalPages = pageData ? Math.ceil(pageData.totalCount / PAGE_SIZE) : 0;

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }

  const activities = pageData?.items ?? [];
  const grouped = groupByDate(activities);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-5 text-muted-foreground" aria-hidden />
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight">
                  {t("activity.title")}
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("activity.description")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                showFilters || hasActiveFilters
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              <Filter className="size-3.5" aria-hidden />
              {t("activity.filter")}
              {hasActiveFilters && (
                <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {[actorFilter, actionFilter, dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Actor filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("activity.filterActor")}
                </label>
                <select
                  value={actorFilter}
                  onChange={(e) => { setActorFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t("activity.allMembers")}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName || m.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action filter */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("activity.filterAction")}
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t("activity.allActions")}</option>
                  {ACTION_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date from */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("activity.dateFrom")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Date to */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("activity.dateTo")}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <X className="size-3" aria-hidden />
                  {t("activity.clearFilters")}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4">
            <div className="rounded-xl border border-border bg-surface p-4 text-sm text-destructive">
              {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : pageData === null ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("activity.loadFailed")}
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
            <Activity className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-display text-lg font-semibold">
              {t("activity.emptyTitle")}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {t("activity.emptyDescription")}
            </p>
          </div>
        ) : (
          <>
            {/* Total count */}
            <p className="mb-3 text-xs text-muted-foreground">
              {t("activity.showingCount", { count: pageData.totalCount })}
            </p>

            {/* Grouped activities */}
            {[...grouped.entries()].map(([dateLabel, items]) => (
              <div key={dateLabel} className="mb-4">
                <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {dateLabel === "today" ? t("activity.today") : dateLabel === "yesterday" ? t("activity.yesterday") : dateLabel}
                </h3>
                <ul className="flex flex-col gap-2">
                  {items.map((activity) => (
                    <li
                      key={activity.id}
                      className="rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-200 hover:border-border-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            <span className="text-foreground">{activity.actorName}</span>
                            <span className="text-muted-foreground"> {activity.action} </span>
                            <span className="text-foreground">{activity.target}</span>
                          </p>
                          {activity.taskItemId && (
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              Task: {activity.taskItemId}
                            </p>
                          )}
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(activity.createdAtUtc)}
                        </time>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                  {t("pagination.prev")}
                </button>
                <span className="text-xs text-muted-foreground">
                  {t("activity.pageOf", { current: currentPage, total: totalPages })}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("pagination.next")}
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
