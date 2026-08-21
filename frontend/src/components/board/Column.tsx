import { useState } from "react";
import type { TaskItemResponse } from "../../types/api";
import { TaskCard } from "./TaskCard";

interface ColumnProps {
  title: string;
  status: TaskItemResponse["status"];
  tasks: TaskItemResponse[];
  onDropTask: (taskId: string, status: TaskItemResponse["status"]) => void;
  onDelete: (task: TaskItemResponse) => void;
  onSelect: (taskId: string) => void;
}

export function Column({
  title,
  status,
  tasks,
  onDropTask,
  onDelete,
  onSelect,
}: ColumnProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <section
      aria-label={title}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragOver(false);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const taskId = event.dataTransfer.getData("text/plain");
        if (taskId) onDropTask(taskId, status);
      }}
      className={`flex min-h-64 w-full flex-col gap-2 rounded-lg border p-3 transition-colors duration-150 sm:flex-1 ${
        dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/50"
      }`}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </header>

      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onDelete={onDelete}
            onSelect={onSelect}
          />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Drop tasks here
          </p>
        )}
      </div>
    </section>
  );
}
