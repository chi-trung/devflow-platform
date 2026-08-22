import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  SquareKanban,
  Search,
  History,
  CalendarRange,
  BarChart3,
  Network,
  Keyboard,
  X,
} from "lucide-react";
import {
  api,
  bulkAssignTasks,
  bulkDeleteTasks,
  bulkMoveTasks,
  pagedItems,
} from "../lib/api";
import { createProjectConnection } from "../lib/realtime";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { Column } from "../components/board/Column";
import { CreateTaskForm } from "../components/board/CreateTaskForm";
import { TaskDetailPanel } from "../components/board/TaskDetailPanel";
import { SprintBar } from "../components/board/SprintBar";
import { ActivityDrawer } from "../components/board/ActivityDrawer";
import { FilterBar } from "../components/board/FilterBar";
import { GraphModal } from "../components/board/GraphModal";
import { KeyboardHelpModal } from "../components/board/KeyboardHelpModal";
import type {
  ActivityResponse,
  LabelResponse,
  ProjectResponse,
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

const TASKS_PER_PAGE = 8;

const COLUMNS: { title: string; status: TaskItemResponse["status"] }[] = [
  { title: "Backlog", status: "Backlog" },
  { title: "In Progress", status: "InProgress" },
  { title: "In Review", status: "InReview" },
  { title: "Done", status: "Done" },
];

interface ParsedSearch {
  text: string;
  status: string;
  priority: string;
  assignee: string;
  label: string;
  blockedOnly: boolean;
}

function parseSearchQuery(raw: string): ParsedSearch {
  const parsed: ParsedSearch = {
    text: "",
    status: "",
    priority: "",
    assignee: "",
    label: "",
    blockedOnly: false,
  };
  const textParts: string[] = [];

  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const match = /^(status|priority|assignee|label|is):(.+)$/i.exec(token);
    if (!match) {
      textParts.push(token);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].toLowerCase();

    if (key === "is" && value === "blocked") {
      parsed.blockedOnly = true;
    } else if (key === "status") {
      const normalized = value.replace(/[-_]/g, "");
      if (normalized === "backlog") parsed.status = "Backlog";
      else if (normalized === "inprogress" || normalized === "wip")
        parsed.status = "InProgress";
      else if (normalized === "inreview" || normalized === "review")
        parsed.status = "InReview";
      else if (normalized === "done" || normalized === "completed")
        parsed.status = "Done";
    } else if (key === "priority") {
      const candidate =
        value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      if (["Low", "Medium", "High", "Critical"].includes(candidate))
        parsed.priority = candidate;
    } else if (key === "assignee") {
      parsed.assignee = value;
    } else if (key === "label") {
      parsed.label = value;
    }
  }

  parsed.text = textParts.join(" ");
  return parsed;
}

export function BoardPage() {
  const { workspaceId = "", projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const { data: labels } = useApi<LabelResponse[]>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/labels`),
    [workspaceId, projectId],
  );

  const {
    data: tasksRaw,
    error,
    loading,
    reload,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/tasks`),
    [workspaceId, projectId],
  );
  const data = pagedItems<TaskItemResponse>(tasksRaw);

  const {
    data: activities,
    loading: activitiesLoading,
    reload: reloadActivities,
  } = useApi<ActivityResponse[]>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/activities`),
    [workspaceId, projectId],
  );

  const [tasks, setTasks] = useState<TaskItemResponse[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<TaskItemResponse | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { currentUser } = useAuth();
  const { push } = useToast();

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  const myRole = members?.find((m) => m.userId === currentUser?.id)?.role;
  const canManageSprints = myRole === "Owner" || myRole === "Admin";

  const parsedSearch = parseSearchQuery(search);
  const operatorLabelId =
    parsedSearch.label
      ? (labels ?? []).find((label) =>
          label.name.toLowerCase().includes(parsedSearch.label),
        )?.id ?? "no-match"
      : "";
  const operatorAssigneeId =
    parsedSearch.assignee === ""
      ? ""
      : parsedSearch.assignee === "me"
        ? (currentUser?.id ?? "no-match")
        : ((members ?? []).find(
            (member) =>
              member.username.toLowerCase().includes(parsedSearch.assignee) ||
              (member.displayName || "")
                .toLowerCase()
                .includes(parsedSearch.assignee),
          )?.userId ?? "no-match");

  const visibleTasks = tasks
    .filter((task) =>
      sprintFilter === "all"
        ? true
        : sprintFilter === "none"
          ? !task.sprintId
          : task.sprintId === sprintFilter,
    )
    .filter((task) =>
      priorityFilter ? task.priority === priorityFilter : true,
    )
    .filter((task) => {
      if (!assigneeFilter) return true;
      if (assigneeFilter === "none") return !task.assigneeId;
      return task.assigneeId === assigneeFilter;
    })
    .filter((task) =>
      labelFilter ? (task.labelIds ?? []).includes(labelFilter) : true,
    )
    .filter((task) => {
      if (!dueFrom && !dueTo) return true;
      if (!task.dueDateUtc) return false;
      const due = new Date(task.dueDateUtc).getTime();
      if (dueFrom && due < new Date(`${dueFrom}T00:00:00`).getTime()) return false;
      if (dueTo && due > new Date(`${dueTo}T23:59:59`).getTime()) return false;
      return true;
    })
    .filter((task) => (blockedOnly ? !!task.isBlocked : true))
    .filter((task) =>
      parsedSearch.status ? task.status === parsedSearch.status : true,
    )
    .filter((task) =>
      parsedSearch.priority ? task.priority === parsedSearch.priority : true,
    )
    .filter((task) =>
      operatorAssigneeId ? task.assigneeId === operatorAssigneeId : true,
    )
    .filter((task) =>
      operatorLabelId ? (task.labelIds ?? []).includes(operatorLabelId) : true,
    )
    .filter((task) => (parsedSearch.blockedOnly ? !!task.isBlocked : true))
    .filter((task) =>
      parsedSearch.text
        ? task.title.toLowerCase().includes(parsedSearch.text.toLowerCase())
        : true,
    );

  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pagedTasks = visibleTasks.slice(
    (safePage - 1) * TASKS_PER_PAGE,
    safePage * TASKS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [sprintFilter, search, priorityFilter, assigneeFilter, labelFilter, dueFrom, dueTo, blockedOnly]);

  useEffect(() => {
    if (data) setTasks(data);
  }, [data]);

  const deepLinkTaskId = searchParams.get("task");
  const deepLinkPriority = searchParams.get("priority");

  useEffect(() => {
    if (
      deepLinkPriority &&
      ["Low", "Medium", "High", "Critical"].includes(deepLinkPriority)
    ) {
      setPriorityFilter(deepLinkPriority);
    }
    setSearchParams({}, { replace: true });
  }, [deepLinkPriority, setSearchParams]);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    if (tasks.some((task) => task.id === deepLinkTaskId)) {
      setSelectedTaskId(deepLinkTaskId);
      setSearchParams({}, { replace: true });
    }
  }, [deepLinkTaskId, tasks, setSearchParams]);

  // Keyboard shortcuts: n=new, / or f=focus filter, ?=help,
  // Ctrl+A=select visible, Delete=bulk delete, Esc=step back.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.closest("input, textarea, select, [contenteditable=true]")
      )
        return;

      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === "a" && !selectedTaskId) {
          event.preventDefault();
          setSelectedIds(new Set(visibleTasks.map((t) => t.id)));
        }
        return;
      }

      switch (event.key) {
        case "n":
          if (!creating && !selectedTaskId && !graphOpen && !helpOpen)
            setCreating(true);
          break;
        case "/":
        case "f": {
          event.preventDefault();
          document
            .querySelector<HTMLInputElement>("input[data-board-search]")
            ?.focus();
          break;
        }
        case "?":
          setHelpOpen((open) => !open);
          break;
        case "Delete":
        case "Backspace":
          if (selectedIds.size > 0 && !selectedTaskId) {
            event.preventDefault();
            setConfirmBulkDelete(true);
          }
          break;
        case "Escape":
          if (graphOpen) setGraphOpen(false);
          else if (helpOpen) setHelpOpen(false);
          else if (confirmBulkDelete) setConfirmBulkDelete(false);
          else if (selectedIds.size > 0) setSelectedIds(new Set());
          break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    creating,
    selectedTaskId,
    selectedIds,
    graphOpen,
    helpOpen,
    confirmBulkDelete,
    visibleTasks,
  ]);

  function toggleSelect(taskId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function runBulk(
    action: () => Promise<void>,
    successMessage: string,
  ) {
    setBoardError(null);
    try {
      await action();
      setSelectedIds(new Set());
      setBulkStatus("");
      setBulkAssignee("");
      reload();
      push(successMessage);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Bulk action failed.";
      setBoardError(message);
      push(message, "error");
    }
  }

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
        reloadActivities();
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
  }, [projectId, reload, reloadSprints, reloadActivities]);

  async function moveTask(taskId: string, status: TaskItemResponse["status"]) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    if (task.isBlocked) {
      const message = `"${task.title}" is blocked — resolve its blockers first.`;
      setBoardError(message);
      push("Task is blocked", "error");
      return;
    }

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
              <Link
                to={`/workspaces/${workspaceId}/projects/${projectId}/sprints`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-foreground transition-all duration-200 hover:border-border-strong hover:bg-elevated active:scale-[0.98]"
              >
                <CalendarRange className="size-4" aria-hidden />
                Sprints
              </Link>
              <Link
                to={`/workspaces/${workspaceId}/projects/${projectId}/reports`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-foreground transition-all duration-200 hover:border-border-strong hover:bg-elevated active:scale-[0.98]"
              >
                <BarChart3 className="size-4" aria-hidden />
                Reports
              </Link>
              <Button
                variant="outline"
                onClick={() => setActivityOpen(true)}
                title="View project activity log"
              >
                <History className="size-4" aria-hidden />
                Activity
              </Button>
              <Button
                variant="outline"
                onClick={() => setGraphOpen(true)}
                title="Dependency graph"
              >
                <Network className="size-4" aria-hidden />
                Graph
              </Button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts (?)"
                className="rounded-lg border border-border p-2 text-muted-foreground transition-all duration-200 hover:border-border-strong hover:text-foreground active:scale-[0.98]"
              >
                <Keyboard className="size-4" aria-hidden />
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 transition-colors duration-200 focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter tasks…  status:done is:blocked"
                data-board-search
                aria-label="Filter tasks by title or search operators"
                className="w-44 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear filter"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
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

        <FilterBar
          projectId={projectId}
          members={members ?? []}
          labels={labels ?? []}
          current={{
            sprint: sprintFilter,
            search,
            priority: priorityFilter ?? "",
            assignee: assigneeFilter,
            label: labelFilter,
            dueFrom,
            dueTo,
            blockedOnly,
          }}
          onChange={(patch) => {
            if (patch.sprint !== undefined) setSprintFilter(patch.sprint);
            if (patch.search !== undefined) setSearch(patch.search);
            if (patch.priority !== undefined)
              setPriorityFilter(patch.priority === "" ? null : patch.priority);
            if (patch.assignee !== undefined) setAssigneeFilter(patch.assignee);
            if (patch.label !== undefined) setLabelFilter(patch.label);
            if (patch.dueFrom !== undefined) setDueFrom(patch.dueFrom);
            if (patch.dueTo !== undefined) setDueTo(patch.dueTo);
            if (patch.blockedOnly !== undefined) setBlockedOnly(patch.blockedOnly);
          }}
        />

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
          <>
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
                    tasks={pagedTasks.filter((t) => t.status === status)}
                    members={members ?? []}
                    onDropTask={(taskId, next) => void moveTask(taskId, next)}
                    onDelete={setPendingDelete}
                    onSelect={setSelectedTaskId}
                    selectionMode={selectedIds.size > 0}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <Pagination
                page={safePage}
                pageCount={pageCount}
                onChange={setPage}
                total={visibleTasks.length}
                pageSize={TASKS_PER_PAGE}
                className="mt-auto border-t border-border pt-4"
              />
            )}
          </>
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

      {confirmBulkDelete && selectedIds.size > 0 && (
        <ConfirmDialog
          title={`Delete ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}?`}
          message="Selected tasks will be permanently removed, along with their comments."
          onConfirm={() => {
            setConfirmBulkDelete(false);
            void runBulk(
              () =>
                bulkDeleteTasks(workspaceId, projectId, [...selectedIds]),
              `Deleted ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}`,
            );
          }}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rise">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-xs font-semibold text-primary">
              {selectedIds.size} selected
            </span>
            <select
              aria-label="Bulk move to status"
              value={bulkStatus}
              onChange={(event) => {
                const status = event.target.value;
                setBulkStatus(status);
                if (status)
                  void runBulk(
                    () =>
                      bulkMoveTasks(workspaceId, projectId, [...selectedIds], status as TaskItemResponse["status"]),
                    `Moved ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}`,
                  );
              }}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">Move to…</option>
              {COLUMNS.map((column) => (
                <option key={column.status} value={column.status}>
                  {column.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Bulk assign member"
              value={bulkAssignee}
              onChange={(event) => {
                const assignee = event.target.value;
                setBulkAssignee(assignee);
                if (assignee)
                  void runBulk(
                    () =>
                      bulkAssignTasks(
                        workspaceId,
                        projectId,
                        [...selectedIds],
                        assignee === "none" ? null : assignee,
                      ),
                    `Updated ${selectedIds.size} task${selectedIds.size === 1 ? "" : "s"}`,
                  );
              }}
              className="max-w-36 rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">Assign to…</option>
              <option value="none">Unassigned</option>
              {(members ?? []).map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.displayName || member.username}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setConfirmBulkDelete(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-destructive hover:text-destructive"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label="Clear selection"
              title="Clear selection (Esc)"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {graphOpen && (
        <GraphModal
          tasks={tasks}
          workspaceId={workspaceId}
          projectId={projectId}
          onSelectTask={setSelectedTaskId}
          onClose={() => setGraphOpen(false)}
        />
      )}

      {helpOpen && <KeyboardHelpModal onClose={() => setHelpOpen(false)} />}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          currentUser={currentUser}
          members={members ?? []}
          sprints={(sprints ?? []).filter((s) => s.status !== "Completed")}
          allTasks={tasks}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onTaskChanged={() => {
            reload();
            reloadSprints();
          }}
        />
      )}

      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={activities ?? null}
        loading={activitiesLoading}
      />
    </AppShell>
  );
}
