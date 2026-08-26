import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, CheckSquare, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import type { TaskItemResponse } from "../../types/api";

interface SubtaskSectionProps {
  workspaceId: string;
  projectId: string;
  task: TaskItemResponse;
  onChanged: () => void;
}

/**
 * Subtask checklist (Sprint 18 F18.2).
 *
 * Backend contract:
 *  - GET  .../tasks/{parentTaskId}/subtasks        -> TaskItemResponse[]
 *  - POST .../tasks/{parentTaskId}/subtasks        body { title, description, priority } -> SubtaskCreatedResponse { id, parentTaskId }
 *  - DELETE .../tasks/{parentTaskId}/subtasks/{id} -> 204
 *
 * "Completion" is a status toggle: Done vs Backlog. We PATCH the subtask
 * (same update endpoint as regular tasks) to flip its status.
 */
export function SubtaskSection({
  workspaceId,
  projectId,
  task,
  onChanged,
}: SubtaskSectionProps) {
  const { t } = useTranslation();
  const base = `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`;

  const [subtasks, setSubtasks] = useState<TaskItemResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setSubtasks(null);
    setError(null);
    api<TaskItemResponse[]>(`${base}/subtasks`)
      .then((items) => {
        if (!cancelled) setSubtasks(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("subtask.loadFailed"),
          );
          setSubtasks([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [base, t]);

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load, task.id]);

  const doneCount = subtasks?.filter((s) => s.status === "Done").length ?? 0;
  const total = subtasks?.length ?? 0;

  async function addSubtask(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;

    setAdding(true);
    setError(null);
    try {
      await api(`${base}/subtasks`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: null,
          priority: "Medium",
        }),
      });
      setNewTitle("");
      load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subtask.addFailed"));
    } finally {
      setAdding(false);
    }
  }

  async function toggle(subtask: TaskItemResponse) {
    if (togglingId) return;
    setTogglingId(subtask.id);
    setError(null);
    const nextStatus = subtask.status === "Done" ? "Idea" : "Done";
    try {
      await api(`/workspaces/${workspaceId}/projects/${projectId}/tasks/${subtask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSubtasks((current) =>
        (current ?? []).map((s) =>
          s.id === subtask.id ? { ...s, status: nextStatus } : s,
        ),
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subtask.toggleFailed"));
    } finally {
      setTogglingId(null);
    }
  }

  async function detach(subtask: TaskItemResponse) {
    setError(null);
    try {
      await api(`${base}/subtasks/${subtask.id}`, { method: "DELETE" });
      setSubtasks((current) =>
        (current ?? []).filter((s) => s.id !== subtask.id),
      );
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("subtask.detachFailed"));
    }
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <CheckSquare className="size-4 text-muted-foreground" aria-hidden />
          {t("subtask.subtasks")}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            ({total})
          </span>
        </h3>
        {total > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("subtask.progress", { done: doneCount, total })}
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-elevated"
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={t("subtask.progress", { done: doneCount, total })}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: total === 0 ? 0 : `${(doneCount / total) * 100}%` }}
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <form onSubmit={addSubtask} className="flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder={t("subtask.addPlaceholder")}
          maxLength={200}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs placeholder:text-muted-foreground/50 transition-colors duration-200 hover:border-border-strong focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-primary disabled:opacity-40"
        >
          {adding ? (
            t("subtask.adding")
          ) : (
            <>
              <Plus className="size-3.5" aria-hidden />
              {t("subtask.addSubtask")}
            </>
          )}
        </button>
      </form>

      {!subtasks ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground">{t("subtask.empty")}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {subtasks.map((subtask) => {
            const done = subtask.status === "Done";
            return (
              <div
                key={subtask.id}
                className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2 text-xs"
              >
                <button
                  type="button"
                  onClick={() => void toggle(subtask)}
                  disabled={togglingId === subtask.id}
                  aria-label={
                    done
                      ? t("subtask.toggleOpenAria")
                      : t("subtask.toggleDoneAria")
                  }
                  className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 disabled:opacity-50 ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-surface hover:border-primary"
                  }`}
                >
                  {done && <Check className="size-3" strokeWidth={3} aria-hidden />}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate ${
                    done ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {subtask.title}
                </span>
                <button
                  type="button"
                  onClick={() => void detach(subtask)}
                  aria-label={t("subtask.detachAria")}
                  title={t("common.delete")}
                  className="rounded p-1 text-muted-foreground opacity-80 transition-all duration-150 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
