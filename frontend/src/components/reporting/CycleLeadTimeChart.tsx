import { useTranslation } from "react-i18next";
import { Activity } from "lucide-react";
import type { CycleLeadTimeResponse } from "../../types/api";

const W = 640;
const H = 220;
const PAD_L = 44;
const PAD_R = 14;
const PAD_T = 18;
const PAD_B = 34;

interface CycleLeadTimeChartProps {
  data: CycleLeadTimeResponse;
  className?: string;
}

export function CycleLeadTimeChart({ data, className = "" }: CycleLeadTimeChartProps) {
  const { t } = useTranslation();

  if (data.tasks.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-border px-6 py-10 text-sm text-muted-foreground ${className}`}
      >
        {t("reports.noCycleLeadData")}
      </div>
    );
  }

  const maxDays = Math.max(1, ...data.tasks.map((t) => Math.max(t.cycleTimeDays, t.leadTimeDays)));
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const slot = plotW / data.tasks.length;
  const dotR = 4;

  const y = (value: number) => PAD_T + plotH * (1 - value / maxDays);

  const tickStep = Math.max(1, Math.ceil(maxDays / 4));
  const ticks: number[] = [];
  for (let v = 0; v <= maxDays; v += tickStep) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxDays) ticks.push(maxDays);

  return (
    <div className={`rounded-lg border border-border bg-surface p-4 ${className}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Activity className="size-4 text-primary" aria-hidden />
          {t("reports.cycleLeadTime")}
        </h3>
        <div className="ml-auto flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>{t("reports.cycleTimeP50")}: {data.cycleTimeP50.toFixed(1)} {t("reports.days")}</span>
          <span>{t("reports.cycleTimeP90")}: {data.cycleTimeP90.toFixed(1)} {t("reports.days")}</span>
          <span>{t("reports.leadTimeP50")}: {data.leadTimeP50.toFixed(1)} {t("reports.days")}</span>
          <span>{t("reports.leadTimeP90")}: {data.leadTimeP90.toFixed(1)} {t("reports.days")}</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("reports.cycleLeadTimeAria", { count: data.tasks.length })}
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

        {data.tasks.map((task, i) => {
          const cx = PAD_L + slot * i + slot / 2;
          return (
            <g key={task.taskId}>
              <circle cx={cx} cy={y(task.cycleTimeDays)} r={dotR} fill="var(--color-primary)" opacity="0.9">
                <title>{`${task.title} — cycle ${task.cycleTimeDays.toFixed(1)}d`}</title>
              </circle>
              <circle cx={cx} cy={y(task.leadTimeDays)} r={dotR} fill="var(--color-muted-foreground)" opacity="0.8">
                <title>{`${task.title} — lead ${task.leadTimeDays.toFixed(1)}d`}</title>
              </circle>
              {i % Math.max(1, Math.floor(data.tasks.length / 8)) === 0 && (
                <text
                  x={cx}
                  y={H - PAD_B + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--color-muted-foreground)"
                  fontFamily="var(--font-mono)"
                >
                  {task.title.length > 10 ? `${task.title.slice(0, 9)}…` : task.title}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex items-center justify-end gap-4 font-mono text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary" aria-hidden />
          {t("reports.cycleTimeLabel")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground" aria-hidden />
          {t("reports.leadTimeLabel")}
        </span>
      </div>
    </div>
  );
}
