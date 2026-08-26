import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
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
  Upload,
  List,
  Bookmark,
  Tag,
  Settings2,
  FileText,
  Webhook,
  Github,
  Activity,
  Users,
} from "lucide-react";
import {
  api,
  bulkAssignTasks,
  bulkDeleteTasks,
  bulkMoveTasks,
  getProjectTaskFieldValues,
  pagedItems,
  reorderTasks,
} from "../lib/api";
import {
  createProjectConnection,
  onConnectionWake,
  startProjectConnection,
  stopProjectConnection,
} from "../lib/realtime";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/ToastProvider";
import { AppShell } from "../components/AppShell";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmojiTile, coverGradient } from "../components/ui/EmojiCover";
import { Pagination } from "../components/ui/Pagination";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorAlert } from "../components/ui/ErrorAlert";
import { EmptyState } from "../components/ui/EmptyState";
import { EmptyBoardIllustration } from "../components/illustrations/EmptyStateIllustrations";
import { Column } from "../components/board/Column";
import { CreateTaskForm } from "../components/board/CreateTaskForm";
import { TaskDetailPanel } from "../components/board/TaskDetailPanel";
import { SprintBar } from "../components/board/SprintBar";
import { ActivityDrawer } from "../components/board/ActivityDrawer";
import { FilterBar } from "../components/board/FilterBar";
import { GraphModal } from "../components/board/GraphModal";
import { KeyboardHelpModal } from "../components/board/KeyboardHelpModal";
import { ImportTasksModal } from "../components/board/ImportTasksModal";
import { BoardPresence } from "../components/board/BoardPresence";
import { usePresence } from "../hooks/usePresence";
import type {
  ActivityResponse,
  CustomFieldValueResponse,
  LabelResponse,
  ProjectResponse,
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

const TASKS_PER_PAGE = 24;

function getColumns(t: (key: string) => string): { title: string; status: TaskItemResponse["status"] }[] {
  return [
    { title: t("board.backlog"), status: "Backlog" },
    { title: t("board.inProgress"), status: "InProgress" },
    { title: t("board.inReview"), status: "InReview" },
    { title: t("board.done"), status: "Done" },
  ];
}

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
  const { t } = useTranslation();
  const COLUMNS = getColumns(t);
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

  const { data: sprintsRaw, reload: reloadSprints } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/sprints`),
    [workspaceId, projectId],
  );
  const sprints = useMemo(
    () => pagedItems<SprintResponse>(sprintsRaw),
    [sprintsRaw],
  );

  const { data: labelsRaw } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/labels`),
    [workspaceId, projectId],
  );
  const labels = useMemo(
    () => pagedItems<LabelResponse>(labelsRaw),
    [labelsRaw],
  );

  const {
    data: tasksRaw,
    error,
    loading,
    reload,
  } = useApi<unknown>(
    // pageSize=100 (the API clamp) so board filters, pagination and the
    // dependency graph operate on the whole project, not the first page.
    () =>
      api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks?page=1&pageSize=100`,
      ),
    [workspaceId, projectId],
  );

  // /activities returns a PagedResult ({ items, totalCount, ... }), not a
  // flat array — unwrap through pagedItems or ActivityDrawer's activities.map
  // crashes the page ("n.map is not a function").
  const {
    data: activitiesRaw,
    loading: activitiesLoading,
    reload: reloadActivities,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/activities`),
    [workspaceId, projectId],
  );
  const activities = useMemo(
    () => pagedItems<ActivityResponse>(activitiesRaw),
    [activitiesRaw],
  );

  // Custom-field values for the whole project in ONE request. The board used
  // to fire a request per TaskCard (N+1) which made project loads slow — this
  // map is passed down to each Column/Card instead.
  const { data: customFieldsByTaskId } = useApi<Map<string, CustomFieldValueResponse[]>>(
    () => getProjectTaskFieldValues(workspaceId, projectId),
    [workspaceId, projectId],
  );

  const [tasks, setTasks] = useState<TaskItemResponse[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
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
  const isAdmin = myRole === "Owner" || myRole === "Admin";

  const { visibleUsers: presenceUsers, remainingCount: presenceRemaining, totalOnline: presenceTotal } =
    usePresence(projectId, members ?? [], currentUser?.id ?? null);

  useEffect(() => {
    if (project?.name) {
      document.title = `${project.name} — DevFlow`;
    }
  }, [project?.name]);

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
    if (tasksRaw) setTasks(pagedItems<TaskItemResponse>(tasksRaw));
  }, [tasksRaw]);

  const deepLinkTaskId = searchParams.get("task");
  const deepLinkPriority = searchParams.get("priority");

  useEffect(() => {
    if (
      deepLinkPriority &&
      ["Low", "Medium", "High", "Critical"].includes(deepLinkPriority)
    ) {
      setPriorityFilter(deepLinkPriority);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("priority");
          return next;
        },
        { replace: true },
      );
    }
  }, [deepLinkPriority, setSearchParams]);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    if (tasks.some((task) => task.id === deepLinkTaskId)) {
      setSelectedTaskId(deepLinkTaskId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("task");
          return next;
        },
        { replace: true },
      );
    }
  }, [deepLinkTaskId, tasks, setSearchParams]);

  // Saved-search handoff from the command palette (?fs=<json>).
  const fsParam = searchParams.get("fs");
  useEffect(() => {
    if (!fsParam) return;
    try {
      const parsed = JSON.parse(fsParam) as {
        q?: string;
        priority?: string;
        due?: string;
      };
      if (typeof parsed.q === "string" && parsed.q) setSearch(parsed.q);
      if (
        ["Low", "Medium", "High", "Critical"].includes(parsed.priority ?? "")
      ) {
        setPriorityFilter(parsed.priority as string);
      }
      const now = new Date();
      const day = (d: Date) => d.toISOString().slice(0, 10);
      if (parsed.due === "overdue") setDueTo(day(now));
      else if (parsed.due === "today") {
        setDueFrom(day(now));
        setDueTo(day(now));
      } else if (parsed.due === "week") {
        setDueTo(day(new Date(now.getTime() + 7 * 86400000)));
      }
    } catch {}
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("fs");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function handleSelectAllInColumn(status: TaskItemResponse["status"], select: boolean) {
    const columnTaskIds = visibleTasks
      .filter((t) => t.status === status)
      .map((t) => t.id);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (select) {
        columnTaskIds.forEach((id) => next.add(id));
      } else {
        columnTaskIds.forEach((id) => next.delete(id));
      }
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
        err instanceof Error ? err.message : t("board.bulkActionFailed");
      setBoardError(message);
      push(message, "error");
    }
  }

  function handleEstimationSaved(_taskId: string, _storyPoints: number | null) {
    reload();
  }

  // Live updates: any change made by anyone in this project triggers a
  // debounced refetch, so open boards stay in sync across browsers.
  useEffect(() => {
    if (!projectId) return;

    const connection = createProjectConnection(projectId);
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

    const ensureLive = () => {
      scheduleReload();
      if (
        connection.state === "Disconnected" &&
        navigator.onLine
      ) {
        void startProjectConnection(connection, projectId);
      }
    };
    const offWake = onConnectionWake(ensureLive);

    // Re-fetch activities when user returns to the tab.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        reloadActivities();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    void startProjectConnection(connection, projectId);

    return () => {
      offWake();
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void stopProjectConnection(connection);
    };
  }, [projectId, reload, reloadSprints, reloadActivities]);

  async function moveTask(
    taskId: string,
    status: TaskItemResponse["status"],
    beforeTaskId?: string | null,
  ) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || (!beforeTaskId && task.status === status)) return;

    if (task.isBlocked && task.status !== status) {
      const message = t("board.blockedMoveDetail", { title: task.title });
      setBoardError(message);
      push(t("task.blocked"), "error");
      return;
    }

    setBoardError(null);

    const moved: TaskItemResponse = {
      ...task,
      status,
      completedAtUtc: status === "Done" ? new Date().toISOString() : null,
    };
    const rest = tasks.filter((t) => t.id !== taskId);

    let insertAt: number;
    if (beforeTaskId) {
      const idx = rest.findIndex((t) => t.id === beforeTaskId);
      insertAt = idx >= 0 ? idx : rest.length;
    } else {
      insertAt = rest.length;
      for (let i = rest.length - 1; i >= 0; i--) {
        if (rest[i].status === status) {
          insertAt = i + 1;
          break;
        }
      }
    }

    const next = [...rest.slice(0, insertAt), moved, ...rest.slice(insertAt)];
    setTasks(next);

    const affectedStatuses = new Set([
      task.status as string,
      status as string,
    ]);
    const payload = [...affectedStatuses].flatMap((col) => {
      let position = 0;
      return next
        .filter((item) => item.status === col)
        .map((item) => ({ id: item.id, status: col, position: position++ }));
    });

    try {
      await reorderTasks(workspaceId, projectId, payload);
      push(
        t("task.movedTo", {
          column: COLUMNS.find((c) => c.status === status)?.title,
        }),
      );
    } catch (err) {
      reload();
      setBoardError(err instanceof Error ? err.message : t("board.moveFailed"));
      push(t("board.couldntMoveTask"), "error");
    }
  }

  async function createTask(input: {
    title: string;
    description: string | null;
    priority: TaskItemResponse["priority"];
    dueDateUtc: string | null;
  }) {
    // Optimistic insert: render the new card immediately at the bottom of the
    // Backlog column (the server default) while the POST is in flight, then
    // reconcile with the real row when the response lands.
    const optimisticId = `opt-${Date.now().toString(36)}`;
    const optimistic: TaskItemResponse = {
      id: optimisticId,
      projectId,
      title: input.title,
      description: input.description,
      status: "Backlog",
      priority: input.priority,
      assigneeId: null,
      sprintId: null,
      dueDateUtc: input.dueDateUtc,
      completedAtUtc: null,
      position: tasks.length,
    };
    setTasks((prev) => [...prev, optimistic]);
    setCreating(false);

    try {
      const created = await api<{ id: string }>(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks`,
        { method: "POST", body: JSON.stringify(input) },
      );
      // Reconcile: swap the optimistic row for the server row (reload also
      // fires, but this removes the temp id immediately for any live edits).
      if (created?.id) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === optimisticId ? { ...t, id: created.id } : t,
          ),
        );
      }
      reload();
      push(t("board.taskCreated"));
    } catch (err) {
      // Roll back the optimistic row on failure.
      setTasks((prev) => prev.filter((t) => t.id !== optimisticId));
      const message =
        err instanceof Error ? err.message : t("board.createFailed");
      setBoardError(message);
      push(message, "error");
    }
  }

  async function deleteTask(task: TaskItemResponse) {
    setBoardError(null);
    try {
      await api(
        `/workspaces/${workspaceId}/projects/${projectId}/tasks/${task.id}`,
        { method: "DELETE" },
      );
      reload();
      push(t("board.taskDeleted"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("board.deleteFailed");
      setBoardError(message);
      push(message, "error");
    }
  }

  const projectNavLinks = [
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/sprints`,
      icon: CalendarRange,
      label: t("nav.sprints"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/reports`,
      icon: BarChart3,
      label: t("nav.reports"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/epics`,
      icon: List,
      label: t("epic.title"),
    },
    { to: "/saved-searches", icon: Bookmark, label: t("savedSearch.title") },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/labels`,
      icon: Tag,
      label: t("label.title"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/fields`,
      icon: Settings2,
      label: t("customField.title"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/settings`,
      icon: Users,
      label: t("projectMember.title"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/templates`,
      icon: FileText,
      label: t("template.title"),
    },
    { to: `/workspaces/${workspaceId}/webhooks`, icon: Webhook, label: t("webhook.title") },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/github`,
      icon: Github,
      label: t("github.title"),
    },
    {
      to: `/workspaces/${workspaceId}/projects/${projectId}/activities`,
      icon: Activity,
      label: t("activity.title"),
    },
    { to: `/workspaces/${workspaceId}/search`, icon: Search, label: t("search.title") },
  ];

  return (
    <AppShell>
      <div className="flex h-full flex-col px-4 py-6 sm:px-6">
        <Link
          to={`/workspaces/${workspaceId}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("board.projects")}
        </Link>

        {project && coverGradient(project.coverColor) && (
          <div
            aria-hidden
            className={`pointer-events-none -mx-2 mb-4 h-10 rounded-lg bg-gradient-to-br ${coverGradient(project.coverColor)} sm:-mx-0`}
          />
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {project?.emoji && <EmojiTile emoji={project.emoji} size="md" />}
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {project?.name ?? <Skeleton className="h-8 w-48" />}
              </h1>
              {project && <Badge tone="teal">{project.key}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("board.dragHint")}
            </p>
          </div>
            <div className="flex w-full min-w-0 flex-col gap-2">
            {/* Presence + project sub-nav share one line. On mobile the nav
                scrolls horizontally (no wrapping) so the row never jumbles;
                on desktop it fits and behaves like before. */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0">
                <BoardPresence
                  users={presenceUsers}
                  remainingCount={presenceRemaining}
                  totalOnline={presenceTotal}
                />
              </div>
              <nav
                aria-label={t("board.projectNav")}
                className="no-scrollbar -mx-1 flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto px-1 py-0.5 sm:flex-wrap sm:overflow-visible"
              >
                {projectNavLinks.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-sm transition-all duration-200 active:scale-[0.98] sm:px-2.5 sm:py-1.5 ${
                        isActive
                          ? "border-border-strong bg-elevated text-foreground"
                          : "border-border text-foreground hover:border-border-strong hover:bg-elevated"
                      }`
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="hidden xs:inline sm:inline">{label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
            {/* Actions row — search + log + graph + help + create. Wraps
                naturally, separate from the nav links so mobile stays tidy. */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setActivityOpen(true)}
                title={t("board.activityLog")}
                className="px-2 sm:px-3"
              >
                <History className="size-4" aria-hidden />
                <span className="hidden xs:inline sm:inline">{t("activity.projectActivity")}</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setGraphOpen(true)}
                title={t("board.dependencyGraph")}
                className="px-2 sm:px-3"
              >
                <Network className="size-4" aria-hidden />
                <span className="hidden xs:inline sm:inline">{t("reports.burndown")}</span>
              </Button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label={t("board.keyboardShortcuts")}
                title={`${t("board.keyboardShortcuts")} (?)`}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-all duration-200 hover:border-border-strong hover:text-foreground active:scale-[0.98]"
              >
                <Keyboard className="size-4" aria-hidden />
              </button>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 transition-colors duration-200 focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("board.filterTasks")}
                data-board-search
                aria-label={t("board.filterSearchHint")}
                className="w-16 bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none sm:w-44"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("board.clearFilter")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </label>
            {!creating && isAdmin && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => setImporting(true)}
                  title={t("board.importTasks")}
                  className="px-2 sm:px-3"
                >
                  <Upload className="size-4" aria-hidden />
                  <span className="hidden xs:inline sm:inline">{t("board.importTasks")}</span>
                </Button>
                <Button
                  onClick={() => setCreating(true)}
                  title={t("board.newTask")}
                  className="px-2 sm:px-3"
                >
                  <Plus className="size-4" aria-hidden />
                  <span className="hidden xs:inline sm:inline">{t("board.newTask")}</span>
                </Button>
              </>
            )}
            {!creating && !isAdmin && (
              <Button onClick={() => setCreating(true)} title={t("board.newTask")} className="px-2 sm:px-3">
                <Plus className="size-4" aria-hidden />
                <span className="hidden xs:inline sm:inline">{t("board.newTask")}</span>
              </Button>
            )}
            </div>
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
          <EmptyState
            icon={<SquareKanban className="size-8 text-muted-foreground" aria-hidden />}
            illustration={<EmptyBoardIllustration className="size-24" />}
            title={t("board.empty")}
            description={t("board.emptyDesc")}
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" aria-hidden />
                {t("board.newTask")}
              </Button>
            }
          />
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
                    customFieldsByTaskId={customFieldsByTaskId ?? undefined}
                    onDropTask={(taskId, next, beforeId) =>
                      void moveTask(taskId, next, beforeId)
                    }
                    onDelete={setPendingDelete}
                    onSelect={setSelectedTaskId}
                    selectionMode={selectedIds.size > 0}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onSelectAllInColumn={(select) => handleSelectAllInColumn(status, select)}
                    workspaceId={workspaceId}
                    projectId={projectId}
                    onEstimationSaved={handleEstimationSaved}
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
          title={t("task.delete") + "?"}
          message={`${pendingDelete.title} ${t("task.deleteConfirm")}`}
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
          title={t("board.deleteTasksConfirm", { count: selectedIds.size })}
          message={t("task.deleteConfirm")}
          onConfirm={() => {
            setConfirmBulkDelete(false);
            void runBulk(
              () =>
                bulkDeleteTasks(workspaceId, projectId, [...selectedIds]),
              t("board.deletedTasksCount", { count: selectedIds.size }),
            );
          }}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rise">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <span className="rounded-md bg-primary/15 px-2 py-1 font-mono text-xs font-semibold text-primary">
              {selectedIds.size} {t("common.confirm")}
            </span>
            <select
              aria-label={t("board.bulkMoveToStatus")}
              value={bulkStatus}
              onChange={(event) => {
                const status = event.target.value;
                setBulkStatus(status);
                if (status)
                  void runBulk(
                    () =>
                      bulkMoveTasks(workspaceId, projectId, [...selectedIds], status as TaskItemResponse["status"]),
                    t("board.movedTasksCount", { count: selectedIds.size }),
                  );
              }}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">{t("task.status")}…</option>
              {COLUMNS.map((column) => (
                <option key={column.status} value={column.status}>
                  {column.title}
                </option>
              ))}
            </select>
            <select
              aria-label={t("board.bulkAssignMember")}
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
                    t("board.updatedTasksCount", { count: selectedIds.size }),
                  );
              }}
              className="max-w-36 rounded-md border border-border bg-card px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
            >
              <option value="">{t("task.assignee")}…</option>
              <option value="none">{t("task.unassigned")}</option>
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
              {t("common.delete")}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              aria-label={t("board.clearSelection")}
              title={`${t("board.clearSelection")} (Esc)`}
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
          onDependencyChanged={() => {
            reload();
            reloadActivities();
          }}
        />
      )}

      {helpOpen && <KeyboardHelpModal onClose={() => setHelpOpen(false)} />}

      {importing && (
        <ImportTasksModal
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={() => setImporting(false)}
          onImported={() => {
            reload();
            reloadSprints();
          }}
          isAdmin={isAdmin}
        />
      )}

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
