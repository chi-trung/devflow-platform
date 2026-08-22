import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChartPie } from "lucide-react";
import type { DashboardData, TaskPriority, TaskStatus } from "../../types/api";

const SIZE = 176;
const RADIUS = 62;
const STROKE = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATUS_COLORS: Record<TaskStatus, string> = {
  Backlog: "#64748b",
  InProgress: "#38bdf8",
  InReview: "#a78bfa",
  Done: "#14b8a6",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  Backlog: "Backlog",
  InProgress: "In Progress",
  InReview: "In Review",
  Done: "Done",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  Low: "#64748b",
  Medium: "#38bdf8",
  High: "#f59e0b",
  Critical: "#ef4444",
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
  const navigate = useNavigate();

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
      aria-label="Task distribution"
      className="rounded-xl border border-border bg-card p-5"
    >
      <h2 className="mb-4 inline-flex items-center gap-1.5 font-display font-semibold">
        <ChartPie className="size-4 text-primary" aria-hidden />
        Distribution
      </h2>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No tasks yet — create a few to see the breakdown.
        </p>
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative shrink-0">
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label="Tasks by status"
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
                tasks
              </text>
            </svg>
          </div>

          <div className="w-full min-w-0 space-y-4">
            <ul className="grid grid-cols-1 gap-1.5">
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

            <div className="space-y-2" role="list" aria-label="Tasks by priority">
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
                    title={`Show ${priority} priority tasks on the board`}
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
