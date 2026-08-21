import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { AppHeader } from "../components/AppHeader";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Column } from "../components/board/Column";
import { CreateTaskForm } from "../components/board/CreateTaskForm";
import type { ProjectResponse, TaskItemResponse } from "../types/api";

const COLUMNS: { title: string; status: TaskItemResponse["status"] }[] = [
  { title: "Backlog", status: "Backlog" },
  { title: "In Progress", status: "InProgress" },
  { title: "In Review", status: "InReview" },
  { title: "Done", status: "Done" },
];

export function BoardPage() {
  const { workspaceId = "", projectId = "" } = useParams();

  const { data: project } = useApi<ProjectResponse>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}`),
    [workspaceId, projectId],
  );

  const {
    data,
    error,
    loading,
    reload,
  } = useApi<TaskItemResponse[]>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/tasks`),
    [workspaceId, projectId],
  );

  const [tasks, setTasks] = useState<TaskItemResponse[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (data) setTasks(data);
  }, [data]);

  async function moveTask(
    taskId: string,
    status: TaskItemResponse["status"],
  ) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    setBoardError(null);
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              completedAtUtc:
                status === "Done" ? new Date().toISOString() : null,
            }
          : t,
      ),
    );

    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            dueDateUtc: task.dueDateUtc,
          }),
        },
      );
    } catch (err) {
      reload();
      setBoardError(
        err instanceof Error ? err.message : "Failed to move task.",
      );
    }
  }

  async function createTask(input: {
    title: string;
    description: string | null;
    priority: TaskItemResponse["priority"];
    dueDateUtc: string | null;
  }) {
    await api<{ id: string }>(
      `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
      { method: "POST", body: JSON.stringify(input) },
    );
    setCreating(false);
    reload();
  }

  async function deleteTask(task: TaskItemResponse) {
    setBoardError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" },
      );
      reload();
    } catch (err) {
      setBoardError(
        err instanceof Error ? err.message : "Failed to delete task.",
      );
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to projects
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">
                {project?.name ?? "…"}
              </h1>
              {project && <Badge tone="teal">{project.key}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              Drag cards between columns to update their status.
            </p>
          </div>
          {!creating && (
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New task
            </Button>
          )}
        </div>

        {creating && (
          <CreateTaskForm
            onCreate={createTask}
            onCancel={() => setCreating(false)}
          />
        )}

        {boardError && (
          <div className="mb-4">
            <ErrorAlert message={boardError} />
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading board…</p>
        ) : error ? (
          <ErrorAlert message={error} />
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row">
            {COLUMNS.map(({ title, status }) => (
              <Column
                key={status}
                title={title}
                status={status}
                tasks={tasks.filter((t) => t.status === status)}
                onDropTask={(taskId, next) => void moveTask(taskId, next)}
                onDelete={(task) => void deleteTask(task)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
