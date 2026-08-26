import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Milestone, TrendingUp, CheckCircle2 } from "lucide-react";
import type { EpicResponse, MilestoneResponse } from "../../types/api";

const DAY_MS = 86_400_000;
const DAY_W = 26;
const LABEL_W = 208;

const statusTone: Record<MilestoneResponse["status"], string> = {
  Planned: "bg-primary/10 text-primary",
  Active: "bg-amber-400/10 text-amber-300",
  Completed: "bg-teal-400/10 text-teal-300",
};

interface MilestoneTimelineProps {
  milestones: MilestoneResponse[];
  epics: EpicResponse[];
  onSelect?: (milestone: MilestoneResponse) => void;
}

interface TrackRow {
  milestone: MilestoneResponse;
  epics: EpicResponse[];
  leftDays: number;
  widthDays: number;
  completionPercent: number;
  unscheduled: boolean;
}

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function MilestoneTimeline({ milestones, epics, onSelect }: MilestoneTimelineProps) {
  const { t } = useTranslation();

  const range = useMemo(() => {
    const startMs: number[] = [];
    const endMs: number[] = [];
    for (const milestone of milestones) {
      if (milestone.targetDateUtc) endMs.push(startOfUtcDay(new Date(milestone.targetDateUtc).getTime()));
    }
    for (const epic of epics) {
      if (epic.startDateUtc) startMs.push(startOfUtcDay(new Date(epic.startDateUtc).getTime()));
      if (epic.endDateUtc) endMs.push(startOfUtcDay(new Date(epic.endDateUtc).getTime()));
    }
    const now = startOfUtcDay(Date.now());
    const rawStart = startMs.length ? Math.min(...startMs) : now;
    const rawEnd = endMs.length ? Math.max(...endMs) : now;
    const rangeStart = startOfUtcDay(rawStart - 7 * DAY_MS);
    const rangeEnd = startOfUtcDay(rawEnd + 14 * DAY_MS);
    return { start: rangeStart, end: rangeEnd };
  }, [milestones, epics]);

  const tracks = useMemo<TrackRow[]>(() => {
    const totalDays = Math.floor((range.end - range.start) / DAY_MS) + 1;
    return milestones.map((milestone) => {
      const milestoneEpics = epics.filter((epic) => epic.milestoneId === milestone.id);
      const completed = milestoneEpics.filter((epic) => epic.completionPercent >= 100).length;
      const completionPercent = milestoneEpics.length === 0
        ? 0
        : Math.round((completed * 100) / milestoneEpics.length);
      const target = milestone.targetDateUtc
        ? startOfUtcDay(new Date(milestone.targetDateUtc).getTime())
        : null;

      if (!target) {
        return {
          milestone,
          epics: milestoneEpics,
          leftDays: 0,
          widthDays: 0,
          completionPercent,
          unscheduled: true,
        };
      }

      const startDay = Math.min(
        totalDays - 1,
        Math.max(0, (target - range.start) / DAY_MS),
      );
      // Plot a fixed-width marker (8 days wide) centred on the target date so
      // the milestone is visible even when the epic bars are short.
      const halfW = 4;
      const left = Math.max(0, startDay - halfW);
      const right = Math.min(totalDays - 1, startDay + halfW);
      return {
        milestone,
        epics: milestoneEpics,
        leftDays: left,
        widthDays: Math.max(1, right - left + 1),
        completionPercent,
        unscheduled: false,
      };
    });
  }, [milestones, epics, range]);

  const totalDays = Math.floor((range.end - range.start) / DAY_MS) + 1;
  const trackW = totalDays * DAY_W;
  const totalW = LABEL_W + trackW;

  const monthTicks = useMemo(() => {
    const ticks: { index: number; label: string }[] = [];
    const d = new Date(range.start);
    d.setUTCDate(1);
    for (let guard = 0; guard < 2400; guard += 1) {
      const ms = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      const index = (ms - range.start) / DAY_MS;
      if (index >= 0 && index < totalDays) {
        ticks.push({ index, label: monthLabel(ms) });
      }
      if (index >= totalDays) break;
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return ticks;
  }, [range.start, totalDays]);

  const todayIndex = (startOfUtcDay(Date.now()) - range.start) / DAY_MS;
  const showToday = todayIndex >= 0 && todayIndex < totalDays;

  if (milestones.length === 0) return null;

  const unscheduled = tracks.filter((tr) => tr.unscheduled);
  const scheduled = tracks.filter((tr) => !tr.unscheduled);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Milestone className="size-4 text-primary" aria-hidden />
          {t("milestone.timelineTitle")}
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {milestones.length} {t("milestone.count")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full" style={{ width: totalW }}>
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-10 shrink-0 bg-card px-4 py-2" style={{ width: LABEL_W }}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("milestone.nameLabel")}
              </span>
            </div>
            <div className="relative h-7" style={{ width: trackW }}>
              {monthTicks.map((tick) => (
                <div
                  key={tick.index}
                  className="absolute inset-y-0 border-l border-border"
                  style={{ left: tick.index * DAY_W }}
                />
              ))}
              {monthTicks.map((tick) => (
                <span
                  key={`lbl-${tick.index}`}
                  className="absolute top-1.5 whitespace-nowrap px-1 font-mono text-[10px] text-muted-foreground"
                  style={{ left: tick.index * DAY_W }}
                >
                  {tick.label}
                </span>
              ))}
              {showToday && (
                <div
                  className="absolute inset-y-0 border-l border-dashed border-primary"
                  style={{ left: todayIndex * DAY_W }}
                />
              )}
            </div>
          </div>

          {scheduled.length === 0 && unscheduled.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("milestone.timelineNoDates")}
            </div>
          )}

          {scheduled.map((row) => (
            <div
              key={row.milestone.id}
              className="group flex border-b border-border/50 last:border-b-0"
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-card px-4 py-3"
                style={{ width: LABEL_W }}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={row.milestone.name}>
                  {row.milestone.name}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${statusTone[row.milestone.status]}`}
                >
                  {t(`milestone.status.${row.milestone.status}`)}
                </span>
              </div>
              <div className="relative py-3" style={{ width: trackW }}>
                <div className="relative h-7 w-full">
                  {monthTicks.map((tick) => (
                    <div
                      key={tick.index}
                      className="absolute inset-y-0 border-l border-border/40"
                      style={{ left: tick.index * DAY_W }}
                    />
                  ))}
                  {showToday && (
                    <div
                      className="absolute inset-y-0 border-l border-dashed border-primary"
                      style={{ left: todayIndex * DAY_W }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect?.(row.milestone)}
                    title={`${row.milestone.name} · ${row.milestone.status}`}
                    className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-full border border-primary/60 bg-primary/10 transition-transform duration-150 hover:scale-y-110"
                    style={{ left: row.leftDays * DAY_W, width: row.widthDays * DAY_W }}
                  >
                    <span
                      className={`h-full ${row.milestone.status === "Completed" ? "bg-teal-400/70" : "bg-primary/40"}`}
                      style={{ width: `${Math.min(100, Math.max(0, row.completionPercent))}%` }}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {unscheduled.length > 0 && (
            <div className="border-t border-border/70 px-4 py-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("milestone.timelineUnscheduled")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {unscheduled.map((row) => (
                  <li key={row.milestone.id}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(row.milestone)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
                    >
                      {row.milestone.name}
                      <span className={`font-mono text-[10px] ${statusTone[row.milestone.status]}`}>
                        {t(`milestone.status.${row.milestone.status}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MilestoneProgress({ milestone, epics }: { milestone: MilestoneResponse; epics: EpicResponse[] }) {
  const { t } = useTranslation();
  const milestoneEpics = epics.filter((epic) => epic.milestoneId === milestone.id);
  const completed = milestoneEpics.filter((epic) => epic.completionPercent >= 100).length;
  const pct = milestoneEpics.length === 0 ? 0 : Math.round((completed * 100) / milestoneEpics.length);
  const overdue =
    milestone.status !== "Completed" &&
    milestone.targetDateUtc !== null &&
    new Date(milestone.targetDateUtc).getTime() < Date.now();

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
        <div
          className={`h-full rounded-full transition-all duration-300 ${overdue ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {pct}% · {completed}/{milestoneEpics.length} {t("milestone.epics")}
      </span>
      {milestoneEpics.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground">
          {milestoneEpics.length > 0 ? (
            <TrendingUp className="size-3 text-primary" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3 text-teal-400" aria-hidden />
          )}
        </span>
      )}
    </div>
  );
}
