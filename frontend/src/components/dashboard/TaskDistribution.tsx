import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChartPie } from "lucide-react";
import type { DashboardData, TaskPriority, TaskStatus } from "../../types/api";

const SIZE = 176;
const RADIUS = 62;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Chart colors resolve from the --chart-* tokens in index.css, which carry a
// per-theme value set (dark-first in @theme, light overrides under html.light).
// Hardcoded Tailwind status hues (sky-400 #38bdf8, amber #f59e0b, violet-400
// #a78bfa, …) were tuned for dark grounds and measured 1.7-2.8:1 on the white
// card in the live-DOM audit — below WCAG 1.4.11's 3:1 floor for graphical
// objects. The tokens keep every donut arc, legend dot and priority bar at
// ≥3:1 against BOTH its theme's card and elevated-track grounds.
const STATUS_COLORS: Record<TaskStatus, string> = {
  Idea: "var(--chart-idea)",
  Planning: "var(--chart-planning)",
  Approval: "var(--chart-approval)",
  Ready: "var(--chart-ready)",
  InProgress: "var(--chart-in-progress)",
  Review: "var(--chart-review)",
  Done: "var(--chart-done)",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low: "var(--chart-low)",
  Medium: "var(--chart-medium)",
  High: "var(--chart-high)",
  Critical: "var(--chart-critical)",
};

const PRIORITY_ORDER: TaskPriority[] = ["Low", "Medium", "High", "Critical"];

function lastBoardPath(): string {
  try {
    return localStorage.getItem("devflow.lastBoardPath") ?? "/";
  } catch {
    return "/";
  }
}

interface TaskDistributionProps {
  data: DashboardData;
}

export function TaskDistribution({ data }: TaskDistributionProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const STATUS_LABELS: Record<TaskStatus, string> = {
    Idea: t("board.idea"),
    Planning: t("board.planning"),
    Approval: t("board.approval"),
    Ready: t("board.ready"),
    InProgress: t("board.inProgress"),
    Review: t("board.review"),
    Done: t("board.done"),
  };

  const statusEntries = useMemo(
    () =>
      (Object.entries(data.tasksByStatus) as [TaskStatus, number][]).filter(
        ([, count]) => count > 0,
      ),
    [data.tasksByStatus],
  );

  const total = statusEntries.reduce((sum, [, count]) => sum + count, 0);
  const maxPriority = Math.max(
    1,
    ...PRIORITY_ORDER.map((p) => data.tasksByPriority[p] ?? 0),
  );

  const segments: { status: TaskStatus; offset: number; fraction: number }[] =
    [];
  let accumulated = 0;
  for (const [status, count] of statusEntries) {
    const fraction = total ? count / total : 0;
    segments.push({
      status,
      offset: accumulated,
      fraction,
    });
    accumulated += fraction;
  }

  function openBoard(params: string) {
    navigate(`${lastBoardPath()}${params}`);
  }

  return (
    <section
      aria-label={t("dashboard.distribution")}
      className="flex flex-col rounded-xl border border-border bg-card p-5"
    >
      <h2 className="mb-4 inline-flex items-center gap-1.5 font-display font-semibold">
        <ChartPie className="size-4 text-primary" aria-hidden />
        {t("dashboard.distribution")}
      </h2>

      {total === 0 ? (
        <div className="flex min-h-[15rem] flex-1 items-center justify-center">
          <p className="text-center text-sm text-muted-foreground">
            {t("dashboard.noTasksCreate")}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-6 sm:flex-row">
          <div className="relative shrink-0">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label={t("dashboard.tasksByStatus")}
            >
              <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="var(--color-elevated)"
                  strokeWidth={STROKE}
                />
                {segments.map(({ status, offset, fraction }) => (
                  <circle
                    key={status}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    stroke={STATUS_COLORS[status]}
                    strokeWidth={STROKE}
                    strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-offset * CIRCUMFERENCE}
                    className="cursor-pointer transition-opacity duration-150 hover:opacity-80"
                    onClick={() =>
                      openBoard(`?status=${encodeURIComponent(status)}`)
                    }
                  >
                    <title>{`${STATUS_LABELS[status]}: ${data.tasksByStatus[status]}`}</title>
                  </circle>
                ))}
              </g>
              <text
                x={SIZE / 2}
                y={SIZE / 2 - 4}
                textAnchor="middle"
                fontSize="26"
                fontWeight="600"
                fill="var(--color-foreground)"
                fontFamily="var(--font-display)"
              >
                {total}
              </text>
              <text
                x={SIZE / 2}
                y={SIZE / 2 + 16}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-muted-foreground)"
                fontFamily="var(--font-mono)"
              >
                {t("dashboard.tasks")}
              </text>
            </svg>
          </div>

          <div className="w-full min-w-0 space-y-4">
            <ul role="list" className="grid grid-cols-1 gap-1.5">
              {statusEntries.map(([status, count]) => (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() =>
                      openBoard(`?status=${encodeURIComponent(status)}`)
                    }
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors duration-150 hover:bg-elevated"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="ml-auto font-mono text-xs">{count}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="space-y-2" role="list" aria-label={t("dashboard.tasksByPriority")}>
              {PRIORITY_ORDER.map((priority) => {
                const count = data.tasksByPriority[priority] ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={priority}
                    type="button"
                    role="listitem"
                    onClick={() =>
                      openBoard(`?priority=${encodeURIComponent(priority)}`)
                    }
                    title={t("dashboard.showPriorityAria", {
                      priority: t(`task.${priority.toLowerCase()}`),
                    })}
                    className="group flex w-full cursor-pointer items-center gap-2.5"
                  >
                    <span className="w-16 shrink-0 text-left font-mono text-[11px] text-muted-foreground group-hover:text-foreground">
                      {priority}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
                      <span
                        className="block h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${(count / maxPriority) * 100}%`,
                          backgroundColor: PRIORITY_COLORS[priority],
                        }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right font-mono text-xs">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
