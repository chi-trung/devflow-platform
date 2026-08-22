import { useId } from "react";
import { TrendingDown } from "lucide-react";
import type { TaskItemResponse } from "../../types/api";

const DAY_MS = 86_400_000;
const W = 640;
const H = 240;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

interface BurndownChartProps {
  startDateUtc: string;
  endDateUtc: string;
  tasks: TaskItemResponse[];
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

function startOfUtcDay(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function formatDay(dateMs: number): string {
  return new Date(dateMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function buildPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

export function BurndownChart({
  startDateUtc,
  endDateUtc,
  tasks,
  className = "",
}: BurndownChartProps) {
  const gradientId = useId();

  const total = tasks.length;
  const start = startOfUtcDay(startDateUtc);
  const endInclusive = startOfUtcDay(endDateUtc);
  const totalDays = Math.floor((endInclusive - start) / DAY_MS) + 1;

  if (!startDateUtc || !endDateUtc || totalDays < 1) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        Add a start and end date to track the burndown.
      </div>
    );
  }

  if (total === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        No tasks in this sprint yet — add some to see the burndown.
      </div>
    );
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (day: number) =>
    PAD_L + plotW * (totalDays === 1 ? 0 : day / (totalDays - 1));
  const y = (value: number) => PAD_T + plotH * (1 - value / total);

  const completions = tasks
    .map((task) =>
      task.completedAtUtc ? new Date(task.completedAtUtc).getTime() : null,
    )
    .filter((t): t is number => t !== null);

  const todayMs = Date.now();
  const todayIndex = Math.floor((todayMs - start) / DAY_MS);

  const idealPoints: Point[] = [];
  const actualPoints: Point[] = [];
  let lastVisibleDay = -1;

  for (let day = 0; day < totalDays; day += 1) {
    const idealValue =
      totalDays === 1 ? 0 : total * (1 - day / (totalDays - 1));
    idealPoints.push({ x: x(day), y: y(Math.max(0, idealValue)) });

    const dayEnd = start + (day + 1) * DAY_MS;
    if (todayMs >= dayEnd || day === totalDays - 1) {
      const done = completions.filter((c) => c < dayEnd).length;
      actualPoints.push({ x: x(day), y: y(total - done) });
      lastVisibleDay = day;
    }
  }

  const areaPath =
    actualPoints.length > 1
      ? `${buildPath(actualPoints)} L${actualPoints[actualPoints.length - 1].x},${y(0)} L${actualPoints[0].x},${y(0)} Z`
      : "";

  const tickStep = Math.max(1, Math.ceil(total / 4));
  const yTicks: number[] = [];
  for (let v = 0; v <= total; v += tickStep) yTicks.push(v);
  if (yTicks[yTicks.length - 1] !== total) yTicks.push(total);

  const labelCount = Math.min(totalDays, 7);
  const xTickDays =
    totalDays === 1
      ? [0]
      : Array.from({ length: labelCount }, (_, i) =>
          Math.round((i * (totalDays - 1)) / (labelCount - 1)),
        ).filter((d, i, arr) => arr.indexOf(d) === i);

  const showTodayLine = todayIndex >= 0 && todayIndex < totalDays - 1;

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <TrendingDown className="size-4 text-primary" aria-hidden />
          Burndown
        </h3>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke="var(--color-muted-foreground)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            </svg>
            Ideal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke="var(--color-primary)"
                strokeWidth="2"
              />
              <circle cx="9" cy="3" r="2.5" fill="var(--color-primary)" />
            </svg>
            Remaining
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Sprint burndown chart, ${total} tasks`}
        className="w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              y1={y(v)}
              x2={W - PAD_R}
              y2={y(v)}
              stroke="var(--color-border)"
              strokeWidth={v === 0 ? 1.5 : 1}
            />
            <text
              x={PAD_L - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}

        {xTickDays.map((day) => (
          <text
            key={day}
            x={x(day)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--color-muted-foreground)"
            fontFamily="var(--font-mono)"
          >
            {formatDay(start + day * DAY_MS)}
          </text>
        ))}

        {showTodayLine && (
          <g>
            <line
              x1={x(todayIndex)}
              y1={PAD_T}
              x2={x(todayIndex)}
              y2={H - PAD_B}
              stroke="var(--color-border-strong)"
              strokeDasharray="3 3"
            />
            <text
              x={x(todayIndex)}
              y={PAD_T - 3}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              today
            </text>
          </g>
        )}

        <path
          d={buildPath(idealPoints)}
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          opacity="0.75"
        />

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        <path
          d={buildPath(actualPoints)}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {actualPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="var(--color-primary)"
            stroke="var(--color-background)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {lastVisibleDay < totalDays - 1 && (
        <p className="mt-1 text-right font-mono text-[10px] text-muted-foreground">
          {totalDays - 1 - lastVisibleDay}d remaining in sprint
        </p>
      )}
    </div>
  );
}
