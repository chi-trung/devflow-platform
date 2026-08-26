import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Flag, Milestone as MilestoneIcon } from "lucide-react";
import type { EpicResponse, MilestoneResponse } from "../../types/api";

const DAY_MS = 86_400_000;
const DAY_W = 26;
const LABEL_W = 208;

interface EpicRoadmapProps {
  epics: EpicResponse[];
  milestones?: MilestoneResponse[];
  onSelect?: (epic: EpicResponse) => void;
  onMilestoneSelect?: (milestone: MilestoneResponse) => void;
}

interface TrackEpic {
  epic: EpicResponse;
  leftDays: number;
  widthDays: number;
  milestone: boolean;
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

export function EpicRoadmap({ epics, milestones, onSelect, onMilestoneSelect }: EpicRoadmapProps) {
  const { t } = useTranslation();

  const range = useMemo(() => {
    const startMs: number[] = [];
    const endMs: number[] = [];
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
  }, [epics]);

  const tracks = useMemo<TrackEpic[]>(() => {
    const totalDays =
      Math.floor((range.end - range.start) / DAY_MS) + 1;
    return epics.map((epic) => {
      const s = epic.startDateUtc
        ? startOfUtcDay(new Date(epic.startDateUtc).getTime())
        : null;
      const e = epic.endDateUtc
        ? startOfUtcDay(new Date(epic.endDateUtc).getTime())
        : null;
      if (!s && !e) return { epic, leftDays: 0, widthDays: 0, milestone: false, unscheduled: true };
      const startDay = Math.max(0, s ? (s - range.start) / DAY_MS : 0);
      const endDay = Math.min(totalDays - 1, e ? (e - range.start) / DAY_MS : totalDays - 1);
      if (s && e) {
        return {
          epic,
          leftDays: startDay,
          widthDays: Math.max(1, endDay - startDay + 1),
          milestone: false,
          unscheduled: false,
        };
      }
      const atDay = (s ? s : e ?? range.start) - range.start;
      const clamped = Math.max(0, Math.min(totalDays - 1, atDay / DAY_MS));
      return { epic, leftDays: clamped, widthDays: 0, milestone: true, unscheduled: false };
    });
  }, [epics, range]);

  const totalDays =
    Math.floor((range.end - range.start) / DAY_MS) + 1;
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

  if (epics.length === 0) return null;

  const unscheduled = tracks.filter((tr) => tr.unscheduled);
  const scheduled = tracks.filter((tr) => !tr.unscheduled);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold">
          <Flag className="size-4 text-primary" aria-hidden />
          {t("epic.roadmapTitle")}
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">
          {epics.length} {t("epic.tasks")}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full" style={{ width: totalW }}>
          <div className="flex border-b border-border">
            <div className="sticky left-0 z-10 shrink-0 bg-card px-4 py-2" style={{ width: LABEL_W }}>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("epic.nameLabel")}
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
              {t("epic.roadmapNoDates")}
            </div>
          )}

          {(milestones ?? []).map((m) => {
            const groupEpics = scheduled.filter((tr) => tr.epic.milestoneId === m.id);
            if (groupEpics.length === 0) return null;
            return (
              <div key={`m-${m.id}`} className="flex border-b border-border/50 last:border-b-0">
                <div
                  className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-card px-4 py-2"
                  style={{ width: LABEL_W }}
                >
                  <MilestoneIcon className="size-3.5 shrink-0 text-primary" aria-hidden />
                  <button
                    type="button"
                    onClick={() => onMilestoneSelect?.(m)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
                    title={m.name}
                  >
                    {m.name}
                  </button>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {t(`milestone.status.${m.status}`)}
                  </span>
                </div>
                <div className="relative py-2" style={{ width: trackW }}>
                  <div className="relative h-5 w-full">
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
                    {groupEpics.map(({ epic, leftDays, widthDays }) => (
                      <button
                        key={epic.id}
                        type="button"
                        onClick={() => onSelect?.(epic)}
                        title={`${epic.name} · ${Math.round(epic.completionPercent)}%`}
                        className="absolute top-1/2 flex h-4 -translate-y-1/2 items-center overflow-hidden rounded-full border border-border-strong bg-elevated transition-transform duration-150 hover:scale-y-110"
                        style={{ left: leftDays * DAY_W, width: Math.max(6, widthDays * DAY_W) }}
                      >
                        <span
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, epic.completionPercent))}%` }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {scheduled.map(({ epic, leftDays, widthDays, milestone }) => (
            <div
              key={epic.id}
              className="group flex border-b border-border/50 last:border-b-0"
            >
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center gap-2 bg-card px-4 py-3"
                style={{ width: LABEL_W }}
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={epic.name}>
                  {epic.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {epic.totalStoryPoints} {t("epic.storyPoints")}
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
                  {milestone ? (
                    <button
                      type="button"
                      onClick={() => onSelect?.(epic)}
                      title={`${epic.name} · ${t("epic.milestone")}`}
                      className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] border border-primary bg-primary/30 transition-colors duration-150 hover:bg-primary/60"
                      style={{ left: leftDays * DAY_W + DAY_W / 2 }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect?.(epic)}
                      title={`${epic.name} · ${Math.round(epic.completionPercent)}%`}
                      className="absolute top-1/2 flex h-5 -translate-y-1/2 items-center overflow-hidden rounded-full border border-border-strong bg-elevated transition-transform duration-150 hover:scale-y-110"
                      style={{ left: leftDays * DAY_W, width: widthDays * DAY_W }}
                    >
                      <span
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, epic.completionPercent))}%`,
                        }}
                      />
                      {widthDays >= 3 && (
                        <span className="absolute inset-0 px-2 text-center font-mono text-[10px] leading-5 text-on-primary">
                          {Math.round(epic.completionPercent)}%
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {unscheduled.length > 0 && (
            <div className="border-t border-border/70 px-4 py-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("epic.roadmapUnscheduled")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {unscheduled.map(({ epic }) => (
                  <li key={epic.id}>
                    <button
                      type="button"
                      onClick={() => onSelect?.(epic)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
                    >
                      {epic.name}
                      <span className="font-mono text-[10px]">
                        {epic.totalStoryPoints} {t("epic.storyPoints")}
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
