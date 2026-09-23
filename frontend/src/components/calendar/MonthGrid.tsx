import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { dayKey, monthGrid, sameDay, type CalendarDay } from "../../lib/calendarMonth";
import type { CalendarTaskItem } from "../../types/api";

interface MonthGridProps {
  year: number;
  /** 0-based month index. */
  monthIndex: number;
  tasks: CalendarTaskItem[];
  workspaceId: string;
  projectId: string;
}

function chipLabel(task: CalendarTaskItem): string {
  return `${task.key} ${task.title}`;
}

export function MonthGrid({
  year,
  monthIndex,
  tasks,
  workspaceId,
  projectId,
}: MonthGridProps) {
  const { t } = useTranslation();
  const cells: CalendarDay[] = monthGrid(year, monthIndex);
  const today = new Date();

  const byDay = new Map<string, CalendarTaskItem[]>();
  for (const task of tasks) {
    if (!task.dueDateUtc) continue;
    const due = new Date(task.dueDateUtc);
    if (Number.isNaN(due.getTime())) continue;
    const key = dayKey(due);
    const list = byDay.get(key);
    if (list) list.push(task);
    else byDay.set(key, [task]);
  }

  const weekdays = [
    t("calendar.weekdayShort.0"),
    t("calendar.weekdayShort.1"),
    t("calendar.weekdayShort.2"),
    t("calendar.weekdayShort.3"),
    t("calendar.weekdayShort.4"),
    t("calendar.weekdayShort.5"),
    t("calendar.weekdayShort.6"),
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        className="grid grid-cols-7 border-b border-border bg-elevated/60"
        role="presentation"
      >
        {weekdays.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" role="grid" aria-label={t("calendar.gridLabel")}>
        {cells.map((cell) => {
          const key = dayKey(cell.date);
          const dayTasks = byDay.get(key) ?? [];
          const isToday = sameDay(cell.date, today);
          const nowMs = Date.now();

          return (
            <div
              key={key}
              role="gridcell"
              aria-label={key}
              className={[
                "min-h-24 border-b border-r border-border p-1.5",
                cell.outside ? "bg-elevated/30" : "bg-card",
              ].join(" ")}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={[
                    "inline-flex size-6 items-center justify-center rounded-full text-xs",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground ring-2 ring-primary/40"
                      : cell.outside
                        ? "text-muted-foreground/60"
                        : "text-foreground",
                  ].join(" ")}
                >
                  {cell.date.getDate()}
                </span>
              </div>
              <ul className="flex flex-col gap-1" role="list">
                {dayTasks.slice(0, 3).map((task) => {
                  const overdue =
                    task.dueDateUtc !== null &&
                    new Date(task.dueDateUtc).getTime() < nowMs &&
                    task.status !== "Done";
                  // Board overlay is the real destination — the legacy
                  // /tasks/:id path only redirects onto ?task=.
                  return (
                    <li key={task.id}>
                      <Link
                        to={`/workspaces/${workspaceId}/projects/${projectId}?task=${encodeURIComponent(task.id)}`}
                        className={[
                          "block truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight transition-colors duration-150 hover:bg-elevated",
                          overdue
                            ? "bg-destructive/10 text-destructive"
                            : "bg-elevated/80 text-foreground",
                        ].join(" ")}
                        title={chipLabel(task)}
                      >
                        <span className="font-mono opacity-70">{task.key}</span>{" "}
                        <span className="truncate">{task.title}</span>
                        {overdue && (
                          <span className="ml-1 font-medium">
                            · {t("calendar.overdue")}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
                {dayTasks.length > 3 && (
                  <li className="px-1.5 text-[10px] text-muted-foreground">
                    +{dayTasks.length - 3}
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {t("calendar.overdueHint")}
      </div>
    </div>
  );
}
