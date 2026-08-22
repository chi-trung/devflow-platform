import { BarChart3 } from "lucide-react";
import type { VelocityResponse } from "../../types/api";

const W = 640;
const H = 220;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 34;

interface VelocityChartProps {
  data: VelocityResponse;
  className?: string;
}

export function VelocityChart({ data, className = "" }: VelocityChartProps) {
  const sprints = data.sprints;

  if (sprints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        No sprints yet — velocity appears after your first sprint.
      </div>
    );
  }

  const maxTasks = Math.max(1, ...sprints.map((s) => s.totalTasks));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const slot = plotW / sprints.length;
  const barW = Math.min(26, slot * 0.32);

  const y = (value: number) => PAD_T + plotH * (1 - value / maxTasks);
  const avgY = y(maxTasks * (data.averageCompletionRate / 100));

  const tickStep = Math.max(1, Math.ceil(maxTasks / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= maxTasks; v += tickStep) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxTasks) ticks.push(maxTasks);

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          Sprint velocity
          <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
            avg {Math.round(data.averageCompletionRate)}% completion
          </span>
        </h3>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden />
            Planned
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
            Completed
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Velocity across ${sprints.length} sprints`}
        className="w-full"
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--color-border)" strokeWidth={v === 0 ? 1.5 : 1} />
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

        <line
          x1={PAD_L}
          y1={avgY}
          x2={W - PAD_R}
          y2={avgY}
          stroke="var(--color-muted-foreground)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
          opacity="0.75"
        />

        {sprints.map((sprint, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          return (
            <g key={sprint.sprintId}>
              <rect
                x={cx - barW - 2}
                y={y(sprint.totalTasks)}
                width={barW}
                height={y(0) - y(sprint.totalTasks)}
                rx="3"
                fill="var(--color-primary)"
                opacity="0.25"
              >
                <title>{`${sprint.sprintName} — planned ${sprint.totalTasks}`}</title>
              </rect>
              <rect
                x={cx + 2}
                y={y(sprint.completedTasks)}
                width={barW}
                height={y(0) - y(sprint.completedTasks)}
                rx="3"
                fill="var(--color-primary)"
              >
                <title>{`${sprint.sprintName} — completed ${sprint.completedTasks}/${sprint.totalTasks} (${Math.round(sprint.completionRate * 100)}%)`}</title>
              </rect>
              <text
                x={cx}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-muted-foreground)"
                fontFamily="var(--font-mono)"
              >
                {sprint.sprintName.length > 12
                  ? `${sprint.sprintName.slice(0, 11)}…`
                  : sprint.sprintName}
              </text>
              <text
                x={cx}
                y={H - PAD_B + 26}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted-foreground)"
                fontFamily="var(--font-mono)"
                opacity="0.8"
              >
                {Math.round(sprint.completionRate * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
