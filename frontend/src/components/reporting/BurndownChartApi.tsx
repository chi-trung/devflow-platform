import { useId, useState } from "react";
import { TrendingDown } from "lucide-react";
import type { BurndownResponse } from "../../types/api";

const W = 640;
const H = 240;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 28;

interface BurndownChartApiProps {
  data: BurndownResponse;
  className?: string;
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatFull(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function BurndownChartApi({ data, className = "" }: BurndownChartApiProps) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const total = Math.max(1, data.totalTasks);
  const points = data.points;
  const days = points.length;

  if (days === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        No burndown data for this range.
      </div>
    );
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (day: number) =>
    PAD_L + plotW * (days === 1 ? 0 : day / (days - 1));
  const y = (value: number) => PAD_T + plotH * (1 - value / total);

  const actualPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.remainingTasks)}`)
    .join(" ");
  const idealPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.idealRemaining)}`)
    .join(" ");
  const areaPath =
    days > 1
      ? `${actualPath} L${x(days - 1)},${y(0)} L${x(0)},${y(0)} Z`
      : "";

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayIndex = points.findIndex((p) => p.date === todayIso);
  const lastDoneIndex =
    todayIndex >= 0 ? todayIndex : points.findLast((_, i) => i <= days - 1) ? days - 1 : -1;

  const tickStep = Math.max(1, Math.ceil(total / 4));
  const yTicks: number[] = [];
  for (let v = 0; v <= total; v += tickStep) yTicks.push(v);
  if (yTicks[yTicks.length - 1] !== total) yTicks.push(total);

  const labelCount = Math.min(days, 7);
  const xTickDays =
    days === 1
      ? [0]
      : Array.from({ length: labelCount }, (_, i) =>
          Math.round((i * (days - 1)) / (labelCount - 1)),
        ).filter((d, i, arr) => arr.indexOf(d) === i);

  const hovered = hover != null ? points[hover] : null;

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <TrendingDown className="size-4 text-primary" aria-hidden />
          Burndown
          <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
            {formatDay(data.startDate)} → {formatDay(data.endDate)} · {data.totalTasks} tasks
          </span>
        </h3>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke="var(--color-muted-foreground)" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Ideal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke="var(--color-primary)" strokeWidth="2" />
              <circle cx="9" cy="3" r="2.5" fill="var(--color-primary)" />
            </svg>
            Remaining
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Burndown chart from ${data.startDate} to ${data.endDate}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
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
            {formatDay(points[day].date)}
          </text>
        ))}

        {todayIndex > 0 && todayIndex < days - 1 && (
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
              y={PAD_T - 4}
              textAnchor="middle"
              fontSize="9"
              fill="var(--color-muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              today
            </text>
          </g>
        )}

        <path d={idealPath} fill="none" stroke="var(--color-muted-foreground)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.75" />

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        <path d={actualPath} fill="none" stroke="var(--color-primary)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={p.date}>
            <circle
              cx={x(i)}
              cy={y(p.remainingTasks)}
              r={hover === i ? 5 : 3}
              fill="var(--color-primary)"
              stroke="var(--color-background)"
              strokeWidth="1.5"
              className="transition-all duration-150"
            />
            <title>{`${formatFull(p.date)} — ${p.remainingTasks} remaining (ideal ${p.idealRemaining})`}</title>
            <rect
              x={x(i) - plotW / (2 * Math.max(1, days - 1))}
              y={PAD_T}
              width={plotW / Math.max(1, days - 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}

        {hovered && (
          <g>
            <line x1={x(hover!)} y1={PAD_T} x2={x(hover!)} y2={H - PAD_B} stroke="var(--color-primary)" strokeWidth="1" opacity="0.4" />
          </g>
        )}
      </svg>

      <div className="mt-1 flex min-h-5 items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          {hovered
            ? `${formatFull(hovered.date)} · ${hovered.remainingTasks} left · ideal ${hovered.idealRemaining}`
            : `${data.totalTasks} tasks in range`}
        </span>
        {lastDoneIndex >= 0 && hovered == null && (
          <span>hover for daily detail</span>
        )}
      </div>
    </div>
  );
}
