import { useState, type FormEvent } from "react";
import { CalendarRange, Plus, Play, Flag } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";
import { ErrorAlert } from "../ui/ErrorAlert";
import type { SprintResponse } from "../../types/api";

interface SprintBarProps {
  sprints: SprintResponse[];
  canManage: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  onChanged: () => void;
  workspaceId: string;
  projectId: string;
}

function fmt(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function SprintBar({
  sprints,
  canManage,
  filter,
  onFilterChange,
  onChanged,
  workspaceId,
  projectId,
}: SprintBarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = `/workspaces/${workspaceId}/projects/${projectId}/sprints`;
  const active = sprints.find((s) => s.status === "Active");
  const planned = sprints.filter((s) => s.status === "Planned");

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Sprint name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(base, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), goal: goal.trim() || null }),
      });
      setName("");
      setGoal("");
      setCreating(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sprint.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(sprintId: string) {
    if (!startDate || !endDate) {
      setError("Pick both start and end dates.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/${sprintId}/start`, {
        method: "POST",
        body: JSON.stringify({
          startDateUtc: new Date(`${startDate}T00:00:00Z`).toISOString(),
          endDateUtc: new Date(`${endDate}T23:59:59Z`).toISOString(),
        }),
      });
      setStartingId(null);
      setStartDate("");
      setEndDate("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sprint.");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete(sprintId: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`${base}/${sprintId}/complete`, { method: "POST" });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete sprint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />

        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Sprint filter</span>
          <select
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
          >
            <option value="all">All tasks</option>
            <option value="none">No sprint</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
                {sprint.status !== "Completed" ? "" : " (done)"}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {active && (
            <>
              <Badge tone="teal">active</Badge>
              <span className="text-sm font-medium">{active.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {fmt(active.startDateUtc)} – {fmt(active.endDateUtc)}
              </span>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleComplete(active.id)}
                >
                  <Flag className="size-3.5" aria-hidden />
                  Complete
                </Button>
              )}
            </>
          )}

          {!active &&
            planned.slice(0, 1).map((sprint) =>
              canManage ? (
                startingId === sprint.id ? null : (
                  <Button
                    key={sprint.id}
                    size="sm"
                    variant="outline"
                    onClick={() => setStartingId(sprint.id)}
                  >
                    <Play className="size-3.5" aria-hidden />
                    Start “{sprint.name}”
                  </Button>
                )
              ) : (
                <span key={sprint.id} className="text-sm text-muted-foreground">
                  Planned: {sprint.name}
                </span>
              ),
            )}

          {!active && planned.length === 0 && (
            <span className="text-sm text-muted-foreground">No sprints yet</span>
          )}

          {canManage && !creating && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" aria-hidden />
              New sprint
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {creating && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rise" noValidate>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
            <Input
              placeholder="Sprint name — e.g. Sprint 12"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
              aria-label="Sprint name"
            />
            <Input
              placeholder="Goal — what should this sprint achieve?"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              aria-label="Sprint goal"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Creating…" : "Create sprint"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {startingId && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3 rise">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Start date
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-auto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            End date
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-auto"
            />
          </label>
          <Button size="sm" disabled={busy} onClick={() => void handleStart(startingId)}>
            {busy ? "Starting…" : "Confirm start"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setStartingId(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
