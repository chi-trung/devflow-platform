import { useTranslation } from "react-i18next";
import { Circle, CircleDot, Eye, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TaskItemResponse, WorkspaceMemberResponse } from "../../types/api";
import { TaskCard } from "./TaskCard";

interface ColumnProps {
  title: string;
  status: TaskItemResponse["status"];
  tasks: TaskItemResponse[];
  members: WorkspaceMemberResponse[];
  onDropTask: (taskId: string, status: TaskItemResponse["status"]) => void;
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
  selectionMode?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (taskId: string) => void;
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
}: ColumnProps) {
  const meta = COLUMN_META[status];
  const Icon = meta.icon;

  const { t } = useTranslation();

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
        if (taskId) onDropTask(taskId, status);
      }}
      data-drag-over="false"
      className="group/column flex min-h-72 w-full flex-1 flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition-colors duration-200 data-[drag-over=true]:border-primary/50 data-[drag-over=true]:bg-primary/5"
    >
      <header className="flex items-center gap-2 px-1 pb-1">
        <Icon className={`size-4 ${meta.accent}`} aria-hidden />
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <span className="ml-auto rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            members={members}
            onDelete={onDelete}
            onSelect={onSelect}
            selectionMode={selectionMode}
            selected={selectedIds?.has(task.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            {t("board.dropHere")}
          </p>
        )}
      </div>
    </section>
  );
}
