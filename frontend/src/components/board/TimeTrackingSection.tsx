import { useEffect, useRef, useState } from "react";
import { Clock, Play, Square, Trash2, TriangleAlert } from "lucide-react";
import {
  api,
  deleteTimeEntry,
  getTimeEntries,
  logTimeEntry,
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
  const [estimateHours, setEstimateHours] = useState(
    task.estimateMinutes != null ? String(task.estimateMinutes / 60) : "",
  );
  const [savingEstimate, setSavingEstimate] = useState(false);

  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
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
            err instanceof Error ? err.message : "Failed to load time entries.",
          );
          setEntries([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  useEffect(() => {
    if (task.estimateMinutes == null) return;
    setEstimateHours(String(task.estimateMinutes / 60));
  }, [task.estimateMinutes]);

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
    const trimmed = estimateHours.trim();
    let minutes: number | null = null;
    if (trimmed !== "") {
      const parsed = parseFloat(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Estimate must be a number of hours.");
        return;
      }
      minutes = Math.round(parsed * 60);
    }
    setSavingEstimate(true);
    setError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            dueDateUtc: task.dueDateUtc,
            estimateMinutes: minutes,
          }),
        },
      );
      onChanged();
      push("Estimate saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save estimate.");
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
      setError("Enter the time spent (greater than zero).");
      return;
    }
    setLogging(true);
    setError(null);
    try {
      const created = await logTimeEntry(workspaceId, projectId, task.id, {
        minutes: total,
        description: entryDescription.trim() || null,
      });
      setEntries((current) => [created, ...(current ?? [])]);
      setHours("");
      setExtraMinutes("");
      setEntryDescription("");
      setTimerRunning(false);
      setElapsedSeconds(0);
      push(`Logged ${formatMinutes(total)}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log time.");
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
      setError(err instanceof Error ? err.message : "Failed to delete entry.");
    }
  }

  const loggedTotal =
    entries?.reduce((sum, entry) => sum + entry.minutes, 0) ??
    task.totalLoggedMinutes ??
    0;
  const estimate = task.estimateMinutes ?? null;
  const percent =
    estimate && estimate > 0 ? Math.min(100, Math.round((loggedTotal / estimate) * 100)) : 0;
  const overBudget = estimate != null && loggedTotal > estimate;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          Time tracking
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
            title="Start tracking"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-all duration-200 hover:border-primary active:scale-[0.98]"
          >
            <Play className="size-3" aria-hidden />
            Start
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          Estimate (h)
          <input
            type="number"
            min={0}
            step={0.5}
            value={estimateHours}
            onChange={(event) => setEstimateHours(event.target.value)}
            placeholder="—"
            className="w-16 rounded-md border border-border bg-surface px-1.5 py-1 text-sm focus:border-primary focus:outline-none"
          />
        </label>
        {estimateHours !== (task.estimateMinutes != null ? String(task.estimateMinutes / 60) : "") && (
          <button
            type="button"
            onClick={() => void saveEstimate()}
            disabled={savingEstimate}
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
          >
            {savingEstimate ? "…" : "Save"}
          </button>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {formatMinutes(loggedTotal)} logged
          {estimate != null ? ` · est. ${formatMinutes(estimate)}` : ""}
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
          Over estimate by {formatMinutes(loggedTotal - (estimate ?? 0))}.
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
          aria-label="Hours spent"
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
          aria-label="Minutes spent"
          className="w-14 rounded-md border border-border bg-surface px-1.5 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <textarea
          ref={descriptionRef}
          value={entryDescription}
          onChange={(event) => setEntryDescription(event.target.value)}
          rows={1}
          placeholder="What did you do?"
          maxLength={500}
          className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={logging}
          className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 hover:border-primary disabled:opacity-40"
        >
          {logging ? "…" : "Log"}
        </button>
      </form>

      {!entries ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No time logged yet — hit Start or log manually.
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
                      <span className="text-muted-foreground">No description</span>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {author?.displayName || author?.username || entry.userName || "user"}{" "}
                    · {new Date(entry.loggedAtUtc).toLocaleString()}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px]">
                    {formatMinutes(entry.minutes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeEntry(entry)}
                    aria-label="Delete time entry"
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
