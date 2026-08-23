import { CalendarRange } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SprintResponse, TaskItemResponse } from "../../types/api";
import { SprintProgress } from "./SprintProgress";

const priorityDot: Record<TaskItemResponse["priority"], string> = {
  Critical: "bg-destructive",
  High: "bg-amber-300",
  Medium: "bg-primary",
  Low: "bg-muted-foreground/50",
};

function fmt(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function dragHandlers(onDropTask: (taskId: string) => void) {
  return {
    onDragOver: (event: React.DragEvent<HTMLElement>) => {
      if (event.currentTarget.dataset.disabled === "true") return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      event.currentTarget.dataset.dragOver = "true";
    },
    onDragLeave: (event: React.DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        delete event.currentTarget.dataset.dragOver;
      }
    },
    onDrop: (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      delete event.currentTarget.dataset.dragOver;
      const taskId = event.dataTransfer.getData("text/plain");
      if (taskId && event.currentTarget.dataset.disabled !== "true") {
        onDropTask(taskId);
      }
    },
  };
}

interface TaskRowProps {
  task: TaskItemResponse;
}

function TaskRow({ task }: TaskRowProps) {
  const { t } = useTranslation();
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", task.id);
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("opacity-40");
      }}
      onDragEnd={(event) => {
        event.currentTarget.classList.remove("opacity-40");
      }}
      className="flex cursor-grab items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 transition-all duration-200 hover:border-border-strong hover:bg-elevated active:cursor-grabbing active:scale-[0.99]"
      aria-label={t("sprint.boardTaskAria", { title: task.title })}
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${priorityDot[task.priority]}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
      <span
        className={`font-mono text-[10px] ${
          task.status === "Done" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {task.status === "Done"
          ? t("sprint.colDone")
          : task.status === "InProgress"
            ? t("sprint.colWip")
            : task.status === "InReview"
              ? t("sprint.colReview")
              : ""}
      </span>
    </li>
  );
}

interface SprintBoardProps {
  tasks: TaskItemResponse[];
  sprints: SprintResponse[];
  onAssign: (taskId: string, sprintId: string) => void;
  onRemove: (taskId: string, sprintId: string) => void;
}

export function SprintBoard({
  tasks,
  sprints,
  onAssign,
  onRemove,
}: SprintBoardProps) {
  const { t } = useTranslation();
  const backlogTasks = tasks.filter((t) => !t.sprintId);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr]">
      <section
        aria-label={t("sprint.backlogColumnAria")}
        data-drag-over="false"
        {...dragHandlers((taskId) => {
          const task = tasks.find((t) => t.id === taskId);
          if (task?.sprintId) onRemove(taskId, task.sprintId);
        })}
        className="flex min-h-72 flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition-colors duration-200 data-[drag-over=true]:border-primary/50 data-[drag-over=true]:bg-primary/5"
      >
        <header className="flex items-center gap-2 px-1 pb-1">
          <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("board.backlog")}
          </h3>
          <span className="ml-auto rounded-md bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {backlogTasks.length}
          </span>
        </header>

        <ul className="flex flex-col gap-2">
          {backlogTasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
          {backlogTasks.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
              {t("sprint.dropTasksRemove")}
            </p>
          )}
        </ul>
      </section>

      <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sprints.map((sprint) => {
          const sprintTasks = tasks.filter((t) => t.sprintId === sprint.id);
          const completed = sprintTasks.filter(
            (t) => t.status === "Done",
          ).length;
          const locked = sprint.status === "Completed";
          const Icon: LucideIcon = CalendarRange;

          return (
            <section
              key={sprint.id}
              aria-label={t("sprint.sprintColumnAria", { name: sprint.name })}
              data-drag-over="false"
              {...(locked ? {} : dragHandlers((taskId) => onAssign(taskId, sprint.id)))}
              className="flex min-h-72 flex-col gap-2 rounded-xl border border-border bg-surface p-3 transition-colors duration-200 data-[drag-over=true]:border-primary/50 data-[drag-over=true]:bg-primary/5"
            >
              <header className="flex items-center gap-2 px-1">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                <h3 className="min-w-0 truncate text-sm font-semibold">
                  {sprint.name}
                </h3>
                <span
                  className={`ml-auto shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] ${
                    sprint.status === "Active"
                      ? "bg-primary/10 text-primary"
                      : sprint.status === "Completed"
                        ? "bg-elevated text-muted-foreground"
                        : "bg-violet-400/10 text-violet-300"
                  }`}
                >
                  {sprint.status.toLowerCase()}
                </span>
              </header>

              {(sprint.startDateUtc || sprint.endDateUtc) && (
                <p className="px-1 font-mono text-[11px] text-muted-foreground">
                  {fmt(sprint.startDateUtc)} – {fmt(sprint.endDateUtc)}
                </p>
              )}

              <SprintProgress
                total={sprintTasks.length}
                completed={completed}
                className="px-1"
              />

              <ul className="flex flex-col gap-2">
                {sprintTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
                {sprintTasks.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    {locked ? t("sprint.noTasksInCol") : t("board.dropHere")}
                  </p>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
