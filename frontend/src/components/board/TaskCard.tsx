import { Clock, Link2 } from "lucide-react";
import type { TaskItemResponse, WorkspaceMemberResponse } from "../../types/api";
import { formatMinutes } from "../../lib/format";
import { Avatar } from "../ui/Avatar";

const priorityMeta: Record<
  TaskItemResponse["priority"],
  { label: string; dot: string }
> = {
  Critical: { label: "Urgent", dot: "bg-destructive" },
  High: { label: "High", dot: "bg-amber-300" },
  Medium: { label: "Medium", dot: "bg-primary" },
  Low: { label: "Low", dot: "bg-muted-foreground/50" },
};

interface TaskCardProps {
  task: TaskItemResponse;
  members: WorkspaceMemberResponse[];
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
}

export function TaskCard({ task, members, onDelete, onSelect }: TaskCardProps) {
  const priority = priorityMeta[task.priority];
  const assignee = members.find((m) => m.userId === task.assigneeId);
  const overdue =
    task.dueDateUtc !== null &&
    task.status !== "Done" &&
    new Date(task.dueDateUtc).getTime() < Date.now();

  return (
    <div
      draggable
      onClick={() => onSelect(task.id)}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("opacity-40");
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove("opacity-40");
      }}
      className="group cursor-grab rounded-lg border border-border bg-card p-3 transition-all duration-200 hover:border-border-strong hover:bg-elevated active:cursor-grabbing active:scale-[0.99]"
      aria-label={`Task: ${task.title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task);
          }}
          aria-label={`Delete task ${task.title}`}
          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-all duration-150 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span className={`size-1.5 rounded-full ${priority.dot}`} aria-hidden />
          {priority.label}
        </span>
        {task.dueDateUtc && (
          <time
            title={overdue ? "Overdue" : undefined}
            className={`font-mono text-[11px] ${overdue ? "font-semibold text-destructive" : "text-muted-foreground"}`}
          >
            {new Date(task.dueDateUtc).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
        )}
        {task.isBlocked && (
          <span
            title="Blocked by dependencies"
            className="flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-destructive"
          >
            <Link2 className="size-3" aria-hidden />
            Blocked
          </span>
        )}
        {(task.totalLoggedMinutes ?? 0) > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {formatMinutes(task.totalLoggedMinutes ?? 0)}
          </span>
        )}
        {assignee && (
          <span
            className="ml-auto"
            title={`Assigned to ${assignee.displayName || assignee.username}`}
          >
            <Avatar name={assignee.displayName || assignee.username} id={assignee.userId} />
          </span>
        )}
      </div>
    </div>
  );
}
