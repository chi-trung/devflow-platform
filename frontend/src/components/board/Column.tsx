import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, CircleDot, Eye, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskItemResponse, WorkspaceMemberResponse } from "../../types/api";
import { TaskCard } from "./TaskCard";

// Cards rendered initially per column; more stream in as the sentinel
// scrolls into view (keeps DOM small on 500+ task projects).
const WINDOW_CHUNK = 12;

interface ColumnProps {
  title: string;
  status: TaskItemResponse["status"];
  tasks: TaskItemResponse[];
  members: WorkspaceMemberResponse[];
  onDropTask: (
    taskId: string,
    status: TaskItemResponse["status"],
    beforeTaskId?: string | null,
  ) => void;
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (taskId: string) => void;
  workspaceId: string;
  projectId: string;
  onEstimationSaved?: (taskId: string, storyPoints: number | null) => void;
}

const COLUMN_META: Record<
  TaskItemResponse["status"],
  { icon: LucideIcon; accent: string }
> = {
  Backlog: { icon: Circle, accent: "text-muted-foreground" },
  InProgress: { icon: CircleDot, accent: "text-primary" },
  InReview: { icon: Eye, accent: "text-violet-300" },
  Done: { icon: CheckCircle2, accent: "text-sky-300" },
};

export function Column({
  title,
  status,
  tasks,
  members,
  onDropTask,
  onDelete,
  onSelect,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  workspaceId,
  projectId,
  onEstimationSaved,
}: ColumnProps) {
  const meta = COLUMN_META[status];
  const Icon = meta.icon;

  const { t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(WINDOW_CHUNK);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Only shrink the window when the list contracts (e.g. filter applied);
  // never reset on routine refetches so scroll position is preserved.
  useEffect(() => {
    setVisibleCount((count) => Math.min(count, tasks.length || WINDOW_CHUNK));
  }, [tasks.length]);

  useEffect(() => {
    if (visibleCount >= tasks.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) =>
            Math.min(count + WINDOW_CHUNK, tasks.length),
          );
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, tasks.length]);

  const shown = useMemo(
    () =>
      tasks.length <= WINDOW_CHUNK
        ? tasks
        : tasks.slice(0, visibleCount),
    [tasks, visibleCount],
  );
  const hiddenCount = tasks.length - shown.length;

  return (
    <section
      aria-label={title}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        event.currentTarget.dataset.dragOver = "true";
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          delete event.currentTarget.dataset.dragOver;
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        delete event.currentTarget.dataset.dragOver;
        const taskId = event.dataTransfer.getData("text/plain");
        if (!taskId) return;

        let beforeTaskId: string | null = null;
        const cards = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("[data-task-id]"),
        );
        for (const card of cards) {
          if (card.dataset.taskId === taskId) continue;
          const rect = card.getBoundingClientRect();
          if (event.clientY < rect.top + rect.height / 2) {
            beforeTaskId = card.dataset.taskId ?? null;
            break;
          }
        }
        onDropTask(taskId, status, beforeTaskId);
      }}
      data-drag-over="false"
      className="group/column flex min-h-72 w-full flex-1 flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition-colors duration-200 data-[drag-over=true]:border-primary/50 data-[drag-over=true]:bg-primary/5"
    >
      <header className="flex items-center gap-2 px-1 pb-1">
        <Icon className={`size-4 ${meta.accent}`} aria-hidden />
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
        {tasks.some((t) => t.storyPoints != null) && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
            {tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)} pts
          </span>
        )}
      </header>

      <div className="flex flex-col gap-2">
        {shown.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onDelete={onDelete}
            onSelect={onSelect}
            selectionMode={selectionMode}
            selected={selectedIds?.has(task.id) ?? false}
            onToggleSelect={onToggleSelect}
            workspaceId={workspaceId}
            projectId={projectId}
            onEstimationSaved={onEstimationSaved}
          />
        ))}
        {hiddenCount > 0 && (
          <div ref={sentinelRef} className="pb-1">
            <button
              type="button"
              onClick={() =>
                setVisibleCount((count) =>
                  Math.min(count + WINDOW_CHUNK, tasks.length),
                )
              }
              className="w-full rounded-lg border border-dashed border-border px-4 py-2 text-center text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground"
            >
              {t("board.showMore", { count: hiddenCount })}
            </button>
          </div>
        )}
        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            {t("board.dropHere")}
          </p>
        )}
      </div>
    </section>
  );
}
