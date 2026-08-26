import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, PencilRuler, ShieldCheck, CircleDot, Play, Eye, CheckCircle2, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskItemResponse, WorkspaceMemberResponse, CustomFieldValueResponse, EpicResponse } from "../../types/api";
import { TaskCard } from "./TaskCard";

// Cards rendered initially per column; more stream in as the sentinel
// scrolls into view (keeps DOM small on 500+ task projects).
const WINDOW_CHUNK = 12;

interface ColumnProps {
  title: string;
  status: TaskItemResponse["status"];
  tasks: TaskItemResponse[];
  members: WorkspaceMemberResponse[];
  epics?: EpicResponse[];
  swimlaneMode?: "none" | "assignee" | "epic";
  customFieldsByTaskId?: ReadonlyMap<string, CustomFieldValueResponse[]>;
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
  onSelectAllInColumn?: (select: boolean) => void;
  workspaceId: string;
  projectId: string;
  onEstimationSaved?: (taskId: string, storyPoints: number | null) => void;
}

const COLUMN_META: Record<
  TaskItemResponse["status"],
  { icon: LucideIcon; accent: string }
> = {
  Idea: { icon: Lightbulb, accent: "text-amber-300" },
  Planning: { icon: PencilRuler, accent: "text-sky-300" },
  Approval: { icon: ShieldCheck, accent: "text-emerald-300" },
  Ready: { icon: CircleDot, accent: "text-primary" },
  InProgress: { icon: Play, accent: "text-sky-400" },
  Review: { icon: Eye, accent: "text-violet-300" },
  Done: { icon: CheckCircle2, accent: "text-teal-300" },
};

export function Column({
  title,
  status,
  tasks,
  members,
  epics = [],
  swimlaneMode = "none",
  customFieldsByTaskId,
  onDropTask,
  onDelete,
  onSelect,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onSelectAllInColumn,
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

  // Swimlane groups: partition the (windowed) tasks by assignee or epic,
  // preserving the natural order. Lanes are sorted by label so the layout
  // stays stable across filters, with "Unassigned"/"No epic" always last.
  const swimlanes = useMemo(() => {
    if (swimlaneMode === "none") return null;
    const groups = new Map<string, TaskItemResponse[]>();
    for (const task of shown) {
      const key =
        swimlaneMode === "assignee"
          ? task.assigneeId ?? "unassigned"
          : task.epicId ?? "no-epic";
      const list = groups.get(key);
      if (list) list.push(task);
      else groups.set(key, [task]);
    }
    const labelFor = (key: string) => {
      if (key === "unassigned") return t("board.swimlaneUnassigned");
      if (key === "no-epic") return t("board.swimlaneNoEpic");
      if (swimlaneMode === "assignee") {
        return (
          members.find((m) => m.userId === key)?.displayName ||
          members.find((m) => m.userId === key)?.username ||
          key
        );
      }
      return epics.find((e) => e.id === key)?.name || key;
    };
    const keys = [...groups.keys()];
    keys.sort((a, b) => {
      const aFallback = a === "unassigned" || a === "no-epic";
      const bFallback = b === "unassigned" || b === "no-epic";
      if (aFallback !== bFallback) return aFallback ? 1 : -1;
      return labelFor(a).localeCompare(labelFor(b));
    });
    return keys.map((key) => ({
      key,
      label: labelFor(key),
      tasks: groups.get(key) ?? [],
    }));
  }, [shown, swimlaneMode, members, epics, t]);

  function renderTasks(taskList: TaskItemResponse[]) {
    return taskList.map((task) => (
      <TaskCard
        key={task.id}
        task={task}
        members={members}
        customFieldValues={customFieldsByTaskId?.get(task.id)}
        onDelete={onDelete}
        onSelect={onSelect}
        selectionMode={selectionMode}
        selected={selectedIds?.has(task.id) ?? false}
        onToggleSelect={onToggleSelect}
        workspaceId={workspaceId}
        projectId={projectId}
        onEstimationSaved={onEstimationSaved}
      />
    ));
  }

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
        {(selectionMode || selectedIds) && onSelectAllInColumn && (
          <button
            type="button"
            role="checkbox"
            aria-checked={
              tasks.length === 0
                ? false
                : tasks.every((t) => selectedIds?.has(t.id))
                ? true
                : false
            }
            aria-label={t("board.selectAllColumn", { title })}
            onClick={() => {
              const allSelected = tasks.every((t) => selectedIds?.has(t.id));
              onSelectAllInColumn(!allSelected);
            }}
            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
              tasks.length > 0 && tasks.every((t) => selectedIds?.has(t.id))
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-strong bg-surface hover:border-primary"
            }`}
          >
            {tasks.length > 0 && tasks.every((t) => selectedIds?.has(t.id)) && (
              <Check className="size-3" strokeWidth={3} aria-hidden />
            )}
          </button>
        )}
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
        {swimlanes ? (
          swimlanes.map((lane) => (
            <div key={lane.key} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 rounded-md bg-elevated/60 px-2 py-1">
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
                  {lane.label}
                </span>
                <span className="shrink-0 rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {lane.tasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 pl-2">
                {renderTasks(lane.tasks)}
              </div>
            </div>
          ))
        ) : (
          renderTasks(shown)
        )}
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
