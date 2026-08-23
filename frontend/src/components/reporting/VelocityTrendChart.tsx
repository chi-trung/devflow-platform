import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import type { VelocityHistoryResponse } from "../../types/api";

const W = 640;
const H = 220;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 34;

interface VelocityTrendChartProps {
  data: VelocityHistoryResponse;
  className?: string;
}

export function VelocityTrendChart({ data, className = "" }: VelocityTrendChartProps) {
  const { t } = useTranslation();
  const points = data.points.slice(0, 10);

  if (points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        {t("reports.noVelocityHistory")}
      </div>
    );
  }

  const maxPoints = Math.max(1, ...points.map((p) => Math.max(p.totalStoryPoints, p.completedStoryPoints)));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const slot = plotW / points.length;
  const barW = Math.min(20, slot * 0.28);

  const y = (value: number) => PAD_T + plotH * (1 - value / maxPoints);
  const avgY = y(data.averageCompleted);

  const tickStep = Math.max(1, Math.ceil(maxPoints / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= maxPoints; v += tickStep) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxPoints) ticks.push(maxPoints);

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" aria-hidden />
          {t("reports.velocityTrend")}
          <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
            {t("reports.avgCompletedPoints", { pct: Math.round(data.averageCompleted) })}
          </span>
        </h3>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary/25" aria-hidden />
            {t("reports.planned")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
            {t("reports.completedLower")}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("reports.velocityTrendAria", { count: points.length })}
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

        {points.map((point, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          return (
            <g key={point.sprintId}>
              <rect
                x={cx - barW - 2}
                y={y(point.totalStoryPoints)}
                width={barW}
                height={y(0) - y(point.totalStoryPoints)}
                rx="3"
                fill="var(--color-primary)"
                opacity="0.25"
              >
                <title>{`${point.sprintName} — planned ${point.totalStoryPoints}`}</title>
              </rect>
              <rect
                x={cx + 2}
                y={y(point.completedStoryPoints)}
                width={barW}
                height={y(0) - y(point.completedStoryPoints)}
                rx="3"
                fill="var(--color-primary)"
              >
                <title>{`${point.sprintName} — completed ${point.completedStoryPoints}/${point.totalStoryPoints}`}</title>
              </rect>
              <text
                x={cx}
                y={H - PAD_B + 14}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-muted-foreground)"
                fontFamily="var(--font-mono)"
              >
                {point.sprintName.length > 12
                  ? `${point.sprintName.slice(0, 11)}…`
                  : point.sprintName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
