import { useEffect, useMemo, useState } from "react";
import { Link2, Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  addTaskDependency,
  getTaskDependencies,
  removeTaskDependency,
} from "../../lib/api";
import type {
  TaskDependencyResponse,
  TaskItemResponse,
} from "../../types/api";

const statusLabel: Record<TaskItemResponse["status"], string> = {
  Backlog: "Backlog",
  InProgress: "In Progress",
  InReview: "In Review",
  Done: "Done",
};

interface DependencySectionProps {
  workspaceId: string;
  projectId: string;
  task: TaskItemResponse;
  allTasks: TaskItemResponse[];
  onChanged: () => void;
}

export function DependencySection({
  workspaceId,
  projectId,
  task,
  allTasks,
  onChanged,
}: DependencySectionProps) {
  const [dependencies, setDependencies] = useState<
    TaskDependencyResponse[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDependencies(null);
    setError(null);
    getTaskDependencies(workspaceId, projectId, task.id)
      .then((deps) => {
        if (!cancelled) setDependencies(deps);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load dependencies.",
          );
          setDependencies([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, workspaceId, projectId]);

  const candidates = useMemo(() => {
    if (!pickerOpen) return [];
    const blockedIds = new Set(dependencies?.map((d) => d.blockerTaskId));
    const needle = query.trim().toLowerCase();
    return allTasks
      .filter((candidate) => candidate.id !== task.id)
      .filter((candidate) => !blockedIds.has(candidate.id))
      .filter((candidate) =>
        needle ? candidate.title.toLowerCase().includes(needle) : true,
      )
      .slice(0, 6);
  }, [pickerOpen, query, allTasks, dependencies, task.id]);

  async function addDependency(blockerTaskId: string) {
    setAddingId(blockerTaskId);
    setError(null);
    try {
      const created = await addTaskDependency(
        workspaceId,
        projectId,
        task.id,
        blockerTaskId,
      );
      const blocker = allTasks.find((t) => t.id === blockerTaskId);
      setDependencies((current) => [
        ...(current ?? []),
        {
          id: created.id,
          blockerTaskId,
          blockerTitle: blocker?.title ?? "task",
          blockerStatus: blocker?.status ?? "Backlog",
        },
      ]);
      setQuery("");
      setPickerOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add dependency.");
    } finally {
      setAddingId(null);
    }
  }

  async function removeDependency(dependency: TaskDependencyResponse) {
    setError(null);
    try {
      await removeTaskDependency(workspaceId, projectId, task.id, dependency.id);
      setDependencies((current) =>
        (current ?? []).filter((d) => d.id !== dependency.id),
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove dependency.");
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4 text-muted-foreground" aria-hidden />
          Blocked by{" "}
          <span className="font-mono text-xs text-muted-foreground">
            ({dependencies?.length ?? 0})
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="text-xs font-medium text-primary hover:underline"
        >
          {pickerOpen ? "Cancel" : "+ Link task"}
        </button>
      </div>

      {dependencies && dependencies.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          This task can't move forward until {dependencies.length}{" "}
          {dependencies.length === 1 ? "blocker is" : "blockers are"} done.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {pickerOpen && (
        <div className="rounded-lg border border-border bg-card p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks in this project…"
            autoFocus
            className="mb-1.5 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          />
          <div className="flex flex-col">
            {candidates.length === 0 ? (
              <p className="px-1 py-1.5 text-xs text-muted-foreground">
                No matching tasks.
              </p>
            ) : (
              candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  disabled={addingId !== null}
                  onClick={() => void addDependency(candidate.id)}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-elevated disabled:opacity-50"
                >
                  <span className="truncate">{candidate.title}</span>
                  <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase text-muted-foreground">
                    {statusLabel[candidate.status]}
                    <Plus className="size-3" aria-hidden />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {!dependencies ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : dependencies.length === 0 ? (
        <p className="text-xs text-muted-foreground">No blockers linked.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {dependencies.map((dependency) => (
            <div
              key={dependency.blockerTaskId}
              className="group flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
                <span className="truncate font-medium text-foreground">
                  {dependency.blockerTitle}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                  {statusLabel[dependency.blockerStatus] ?? dependency.blockerStatus}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void removeDependency(dependency)}
                aria-label={`Remove blocker ${dependency.blockerTitle}`}
                className="rounded p-1 text-muted-foreground opacity-80 transition-all duration-150 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
