import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Play, Square, Trash2, TriangleAlert } from "lucide-react";
import {
  deleteTimeEntry,
  getTimeEntries,
  logTimeEntry,
  setTaskEstimation,
} from "../../lib/api";
import { formatMinutes } from "../../lib/format";
import { useToast } from "../ui/ToastProvider";
import type {
  TaskItemResponse,
  TimeEntryResponse,
  WorkspaceMemberResponse,
} from "../../types/api";

interface TimeTrackingSectionProps {
  workspaceId: string;
  projectId: string;
  task: TaskItemResponse;
  members: WorkspaceMemberResponse[];
  onChanged: () => void;
}

export function TimeTrackingSection({
  workspaceId,
  projectId,
  task,
  members,
  onChanged,
}: TimeTrackingSectionProps) {
  const [entries, setEntries] = useState<TimeEntryResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [extraMinutes, setExtraMinutes] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [logging, setLogging] = useState(false);

  // Story-point estimate — the only persistable estimate the backend offers
  // (PUT /tasks/{id}/estimation). The old "estimateMinutes" UI PATCHed a field
  // the backend silently drops, so saves never persisted.
  const [estimatePoints, setEstimatePoints] = useState(
    task.storyPoints != null ? String(task.storyPoints) : "",
  );
  const [savingEstimate, setSavingEstimate] = useState(false);

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const { t } = useTranslation();
  const { push } = useToast();

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    getTimeEntries(workspaceId, projectId, task.id)
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("timeTracking.loadFailed"),
          );
          setEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  useEffect(() => {
    if (task.storyPoints == null) return;
    setEstimatePoints(String(task.storyPoints));
  }, [task.storyPoints]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  function startTimer() {
    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    setTimerRunning(true);
  }

  function stopTimer() {
    setTimerRunning(false);
    const totalMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setHours(String(Math.floor(totalMinutes / 60)));
    setExtraMinutes(String(totalMinutes % 60));
    descriptionRef.current?.focus();
  }

  async function saveEstimate() {
    const trimmed = estimatePoints.trim();
    let points: number | null = null;
    if (trimmed !== "") {
      const parsed = parseFloat(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(t("timeTracking.estimateMustBeNumber"));
        return;
      }
      points = Math.round(parsed);
    }
    setSavingEstimate(true);
    setError(null);
    try {
      // Persists via the real estimation endpoint (story points). The old
      // PATCH-with-estimateMinutes path was silently dropped by the backend.
      await setTaskEstimation(workspaceId, projectId, task.id, points);
      onChanged();
      push(t("timeTracking.estimateSaved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("timeTracking.saveEstimateFailed"));
    } finally {
      setSavingEstimate(false);
    }
  }

  async function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    const h = parseInt(hours || "0", 10) || 0;
    const m = parseInt(extraMinutes || "0", 10) || 0;
    const total = h * 60 + m;
    if (total <= 0) {
      setError(t("timeTracking.enterTimeSpent"));
      return;
    }
    setLogging(true);
    setError(null);
    try {
      await logTimeEntry(workspaceId, projectId, task.id, {
        minutes: total,
        description: entryDescription.trim() || null,
      });
      const fresh = await getTimeEntries(workspaceId, projectId, task.id);
      setEntries(fresh);
      setHours("");
      setExtraMinutes("");
      setEntryDescription("");
      setTimerRunning(false);
      setElapsedSeconds(0);
      push(t("timeTracking.loggedTotal", { time: formatMinutes(total) }));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("timeTracking.logFailed"));
    } finally {
      setLogging(false);
    }
  }

  async function removeEntry(entry: TimeEntryResponse) {
    setError(null);
    try {
      await deleteTimeEntry(workspaceId, projectId, task.id, entry.id);
      setEntries((current) => (current ?? []).filter((e) => e.id !== entry.id));
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("timeTracking.deleteEntryFailed"));
    }
  }

  const loggedTotal =
    entries?.reduce((sum, entry) => sum + entry.minutes, 0) ?? 0;
  const estimate = task.storyPoints ?? null;
  const percent =
    estimate && estimate > 0 ? Math.min(100, Math.round((loggedTotal / (estimate * 60)) * 100)) : 0;
  const overBudget = estimate != null && loggedTotal > estimate * 60;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          {t("timeTracking.timeTracking")}
        </h3>
        {timerRunning ? (
          <button
            type="button"
            onClick={stopTimer}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-2.5 py-1 font-mono text-xs font-semibold text-destructive transition-all duration-200 hover:bg-destructive/20 active:scale-[0.98]"
          >
            <Square className="size-3" aria-hidden />
            {String(Math.floor(elapsedSeconds / 3600)).padStart(2, "0")}:
            {String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, "0")}:
            {String(elapsedSeconds % 60).padStart(2, "0")}
          </button>
        ) : (
          <button
            type="button"
            onClick={startTimer}
            title={t("timeTracking.startTracking")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary active:scale-[0.98]"
          >
            <Play className="size-3" aria-hidden />
            {t("timeTracking.start")}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          {t("timeTracking.estimatePoints")}
          <input
            type="number"
            min={0}
            step={1}
            value={estimatePoints}
            onChange={(event) => setEstimatePoints(event.target.value)}
            placeholder="—"
            className="w-16 rounded-md border border-border bg-surface px-1.5 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        {estimatePoints !== (task.storyPoints != null ? String(task.storyPoints) : "") && (
          <button
            type="button"
            onClick={() => void saveEstimate()}
            disabled={savingEstimate}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
          >
            {savingEstimate ? "…" : t("timeTracking.save")}
          </button>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {t("timeTracking.loggedTotal", { time: formatMinutes(loggedTotal) })}
          {estimate != null
            ? ` ${t("timeTracking.estPrefix", { time: formatMinutes(estimate) })}`
            : ""}
        </span>
      </div>

      {estimate != null && (
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-1.5 overflow-hidden rounded-full ${overBudget ? "bg-destructive/20" : "bg-elevated"}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${overBudget ? "bg-destructive" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      {overBudget && (
        <p className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t("timeTracking.overEstimate", {
            time: formatMinutes(loggedTotal - (estimate ?? 0) * 60),
          })}
        </p>
      )}

      <form onSubmit={submitEntry} className="flex items-end gap-1.5">
        <input
          type="number"
          min={0}
          max={23}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          placeholder="h"
          aria-label={t("timeTracking.hoursAria")}
          className="w-14 rounded-md border border-border bg-surface px-1.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <input
          type="number"
          min={0}
          max={59}
          step={5}
          value={extraMinutes}
          onChange={(event) => setExtraMinutes(event.target.value)}
          placeholder="m"
          aria-label={t("timeTracking.minutesAria")}
          className="w-14 rounded-md border border-border bg-surface px-1.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <textarea
          ref={descriptionRef}
          value={entryDescription}
          onChange={(event) => setEntryDescription(event.target.value)}
          rows={1}
          placeholder={t("timeTracking.whatDidYouDo")}
          maxLength={500}
          className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={logging}
          className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
        >
          {logging ? "…" : t("timeTracking.log")}
        </button>
      </form>

      {!entries ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("timeTracking.noTimeLogged")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => {
            const author = members.find((m) => m.userId === entry.userId);
            return (
              <div
                key={entry.id}
                className="group flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate text-foreground">
                    {entry.description || (
                      <span className="text-muted-foreground">
                        {t("timeTracking.noDescription")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {author?.displayName || author?.username || entry.userName || "user"}{" "}
                    ·{" "}
                    {new Date(
                      entry.dateUtc ?? entry.createdAtUtc ?? Date.now(),
                    ).toLocaleString()}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
                    {formatMinutes(entry.minutes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry)}
                    aria-label={t("timeTracking.deleteEntryAria")}
                    className="rounded p-1 text-muted-foreground opacity-80 transition-all duration-150 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
