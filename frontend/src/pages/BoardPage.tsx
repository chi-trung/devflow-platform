import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, SquareKanban, Search } from "lucide-react";
import { api } from "../lib/api";
import { createProjectConnection } from "../lib/realtime";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
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
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<TaskItemResponse | null>(
    null,
  );
  const { currentUser } = useAuth();
  const { push } = useToast();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const myRole = members?.find((m) => m.userId === currentUser?.id)?.role;
  const canManageSprints = myRole === "Owner" || myRole === "Admin";

  const visibleTasks = tasks
    .filter((task) =>
      sprintFilter === "all"
        ? true
        : sprintFilter === "none"
          ? !task.sprintId
          : task.sprintId === sprintFilter,
    )
    .filter((task) =>
      search.trim()
        ? task.title.toLowerCase().includes(search.trim().toLowerCase())
        : true,
    );

  useEffect(() => {
    if (data) setTasks(data);
  }, [data]);

  // Live updates: any change made by anyone in this project triggers a
  // debounced refetch, so open boards stay in sync across browsers.
  useEffect(() => {
    if (!projectId) return;

    const connection = createProjectConnection();
    let timer: number | undefined;
    const scheduleReload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        reload();
        reloadSprints();
      }, 400);
    };

    connection.on("project-event", scheduleReload);
    connection
      .start()
      .then(() => connection.invoke("JoinProject", projectId))
      .catch(() => {
        /* board still works without realtime */
      });

    return () => {
      window.clearTimeout(timer);
      void connection.stop();
    };
  }, [projectId, reload, reloadSprints]);

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
      push(`Moved to ${COLUMNS.find((c) => c.status === status)?.title}`);
    } catch (err) {
      reload();
      setBoardError(err instanceof Error ? err.message : "Failed to move task.");
      push("Couldn't move that task", "error");
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
    push("Task created");
  }

  async function deleteTask(task: TaskItemResponse) {
    setBoardError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" },
      );
      reload();
      push("Task deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete task.";
      setBoardError(message);
      push(message, "error");
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

        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
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
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 transition-colors duration-200 focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter tasks…"
                aria-label="Filter tasks by title"
                className="w-36 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </label>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                New task
              </Button>
            )}
          </div>
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
                  onDelete={setPendingDelete}
                  onSelect={setSelectedTaskId}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this task?"
          message={`“${pendingDelete.title}” will be permanently removed, along with its comments.`}
          onConfirm={() => {
            const task = pendingDelete;
            setPendingDelete(null);
            void deleteTask(task);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

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
