import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, SquareKanban } from "lucide-react";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Column } from "../components/board/Column";
import { CreateTaskForm } from "../components/board/CreateTaskForm";
import { TaskDetailPanel } from "../components/board/TaskDetailPanel";
import { SprintBar } from "../components/board/SprintBar";
import type {
  ProjectResponse,
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

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

  const { data: members } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
  );

  const { data: sprints, reload: reloadSprints } = useApi<SprintResponse[]>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/sprints`),
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const { currentUser } = useAuth();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const myRole = members?.find((m) => m.userId === currentUser?.id)?.role;
  const canManageSprints = myRole === "Owner" || myRole === "Admin";

  const visibleTasks =
    sprintFilter === "all"
      ? tasks
      : sprintFilter === "none"
        ? tasks.filter((t) => !t.sprintId)
        : tasks.filter((t) => t.sprintId === sprintFilter);

  useEffect(() => {
    if (data) setTasks(data);
  }, [data]);

  async function moveTask(taskId: string, status: TaskItemResponse["status"]) {
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
      setBoardError(err instanceof Error ? err.message : "Failed to move task.");
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
    <AppShell>
      <div className="flex h-full flex-col px-6 py-6">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Projects
        </Link>

        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {project?.name ?? <Skeleton className="h-8 w-48" />}
              </h1>
              {project && <Badge tone="teal">{project.key}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Drag cards between columns — changes save instantly.
            </p>
          </div>
          {!creating && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New task
            </Button>
          )}
        </div>

        {sprints && sprints.length >= 0 && (
          <SprintBar
            sprints={sprints}
            canManage={canManageSprints}
            filter={sprintFilter}
            onFilterChange={setSprintFilter}
            onChanged={() => {
              reloadSprints();
              reload();
            }}
            workspaceId={workspaceId}
            projectId={projectId}
          />
        )}

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
          <div className="flex flex-col gap-4 lg:flex-row">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 flex-1" />
            ))}
          </div>
        ) : error ? (
          <ErrorAlert message={error} />
        ) : tasks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-8 py-16 text-center rise">
            <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <SquareKanban className="size-6" aria-hidden />
            </span>
            <p className="font-display text-lg font-semibold">
              This board is empty
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add the first task and drag it across columns as work progresses.
            </p>
            <Button className="mt-5" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden />
              New task
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4 lg:flex-row">
            {COLUMNS.map(({ title, status }, index) => (
              <div
                key={status}
                className="rise flex min-w-0 flex-1 flex-col"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Column
                  title={title}
                  status={status}
                  tasks={visibleTasks.filter((t) => t.status === status)}
                  members={members ?? []}
                  onDropTask={(taskId, next) => void moveTask(taskId, next)}
                  onDelete={(task) => void deleteTask(task)}
                  onSelect={setSelectedTaskId}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          currentUser={currentUser}
          members={members ?? []}
          sprints={(sprints ?? []).filter((s) => s.status !== "Completed")}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onTaskChanged={() => {
            reload();
            reloadSprints();
          }}
        />
      )}
    </AppShell>
  );
}
