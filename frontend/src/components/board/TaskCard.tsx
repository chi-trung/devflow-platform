import type { TaskItemResponse } from "../../types/api";

const priorityStyles: Record<TaskItemResponse["priority"], string> = {
  Critical: "bg-destructive/10 text-destructive",
  High: "bg-accent/10 text-accent",
  Medium: "bg-primary/10 text-primary",
  Low: "bg-muted text-muted-foreground",
};

interface TaskCardProps {
  task: TaskItemResponse;
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
}

export function TaskCard({ task, onDelete, onSelect }: TaskCardProps) {
  return (
    <div
      draggable
      onClick={() => onSelect(task.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="group cursor-grab rounded-md border border-border bg-card p-3 transition-colors duration-150 hover:border-primary active:cursor-grabbing"
      aria-label={`Task: ${task.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <button
          type="button"
          onClick={() => onDelete(task)}
          aria-label={`Delete task ${task.title}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium uppercase ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>
        {task.dueDateUtc && (
          <time className="font-mono text-xs text-muted-foreground">
            {new Date(task.dueDateUtc).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
        {task.status === "Done" && (
          <span className="ml-auto font-mono text-xs text-primary">done</span>
        )}
      </div>
    </div>
  );
}
