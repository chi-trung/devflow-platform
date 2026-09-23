import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { useApi } from "../hooks/useApi";
import { getProjectCalendarTasks } from "../lib/api";
import { isoBoundUtc, monthGrid } from "../lib/calendarMonth";
import { MonthGrid } from "../components/calendar/MonthGrid";
import { RecurringRulesList } from "../components/calendar/RecurringRulesList";
import type { CalendarTaskListResponse } from "../types/api";

const monthLabelKey = [
  "calendar.month.0",
  "calendar.month.1",
  "calendar.month.2",
  "calendar.month.3",
  "calendar.month.4",
  "calendar.month.5",
  "calendar.month.6",
  "calendar.month.7",
  "calendar.month.8",
  "calendar.month.9",
  "calendar.month.10",
  "calendar.month.11",
] as const;

export function CalendarPage() {
  const { t } = useTranslation();
  const { workspaceId = "", projectId = "" } = useParams();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());

  // Stable ISO bounds for the visible 6-week grid so a pure month rename
  // (title re-render) does not refetch. Recomputed only when the cursor moves.
  const { from, to } = useMemo(() => {
    const cells = monthGrid(year, monthIndex);
    const start = cells[0].date;
    const end = cells[cells.length - 1].date;
    return {
      from: isoBoundUtc(start),
      to: isoBoundUtc(end, true),
    };
  }, [year, monthIndex]);

  const {
    data: calendar,
    error,
    loading,
    reload,
  } = useApi<CalendarTaskListResponse>(
    () => getProjectCalendarTasks(workspaceId, projectId, from, to),
    [workspaceId, projectId, from, to],
  );

  const shiftMonth = useCallback((delta: number) => {
    setMonthIndex((m) => {
      const next = m + delta;
      if (next < 0) {
        setYear((y) => y - 1);
        return 11;
      }
      if (next > 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return next;
    });
  }, []);

  const goToday = useCallback(() => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  }, []);

  // Fail-closed: error + no data → banner + retry (never EmptyState).
  // Empty only when a successful response has zero items.
  const items = calendar?.items ?? [];
  const showError = error !== null && calendar === null;
  const showEmpty = error === null && calendar !== null && items.length === 0;
  const showSkeleton = loading && calendar === null && error === null;
  const showGrid = calendar !== null && !(error !== null && calendar === null);

  const monthTitle = `${t(monthLabelKey[monthIndex])} ${year}`;

  useEffect(() => {
    document.title = `${monthTitle} · ${t("calendar.title")}`;
  }, [monthTitle, t]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <Link
            to={`/workspaces/${workspaceId}/projects/${projectId}`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t("common.back")}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {t("calendar.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("calendar.description")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => shiftMonth(-1)}
                aria-label={t("calendar.prev")}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span
                className="min-w-36 text-center text-sm font-medium"
                aria-live="polite"
              >
                {monthTitle}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => shiftMonth(1)}
                aria-label={t("calendar.next")}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                {t("calendar.today")}
              </Button>
            </div>
          </div>
        </div>

        {showError && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ErrorAlert id="calendar-load-error" message={error} />
            <Button variant="outline" size="sm" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {showSkeleton && (
          <div className="space-y-3" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        )}

        {showEmpty && (
          <EmptyState
            icon={<CalendarDays className="size-8" aria-hidden />}
            title={t("calendar.emptyTitle")}
            description={t("calendar.emptyDescription")}
          />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            {showGrid && calendar !== null && (
              <MonthGrid
                year={year}
                monthIndex={monthIndex}
                tasks={items}
                workspaceId={workspaceId}
                projectId={projectId}
              />
            )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
              {t("calendar.rulesTitle")}
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {t("calendar.rulesDescription")}
            </p>
            <RecurringRulesList
              workspaceId={workspaceId}
              projectId={projectId}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
