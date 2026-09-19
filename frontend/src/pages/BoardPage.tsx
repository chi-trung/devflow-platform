import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  SquareKanban,
  Search,
  History,
  Network,
  Keyboard,
  X,
  Upload,
} from "lucide-react";
import {
  api,
  bulkAssignTasks,
  bulkDeleteTasks,
  bulkMoveTasks,
  getProjectDependencyGraph,
  getProjectTaskFieldValues,
  pagedItems,
  reorderTasks,
  type BoardFilterState,
} from "../lib/api";
import {
  createProjectConnection,
  onConnectionWake,
  releaseProjectConnection,
  retainProjectConnection,
  startProjectConnection,
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
import { getEpics } from "../lib/api";
import { areCharacterShortcutsEnabled } from "../lib/keyboardShortcuts";
import type {
  ActivityResponse,
  EpicResponse,
  LabelResponse,
  ProjectResponse,
  SprintResponse,
  TaskItemResponse,
  WorkspaceMemberResponse,
} from "../types/api";

const TASKS_PER_PAGE = 24;

// Stable identity for columns whose status has no tasks this page: Column's
// windowing memos key on `tasks` by identity, so the empty array must not be
// a fresh literal per render either. The same rule applies to the members,
// epics and labels lists — TaskCard, Column and FilterBar are all memoised and
// take one of these as a prop.
const EMPTY_TASKS: TaskItemResponse[] = [];
const EMPTY_MEMBERS: WorkspaceMemberResponse[] = [];
const EMPTY_EPICS: EpicResponse[] = [];
const EMPTY_LABELS: LabelResponse[] = [];


function getColumns(t: (key: string) => string): { title: string; status: TaskItemResponse["status"] }[] {
  return [
    { title: t("board.idea"), status: "Idea" },
    { title: t("board.planning"), status: "Planning" },
    { title: t("board.approval"), status: "Approval" },
    { title: t("board.ready"), status: "Ready" },
    { title: t("board.inProgress"), status: "InProgress" },
    { title: t("board.review"), status: "Review" },
    { title: t("board.done"), status: "Done" },
  ];
}

interface ParsedSearch {
  text: string;
  status: string;
  priority: string;
  assignee: string;
  label: string;
  /** "" | "open" | "merged" | "closed" | "none" (prSummary-derived). */
  pr: string;
  blockedOnly: boolean;
}

function parseSearchQuery(raw: string): ParsedSearch {
  const parsed: ParsedSearch = {
    text: "",
    status: "",
    priority: "",
    assignee: "",
    label: "",
    pr: "",
    blockedOnly: false,
  };
  const textParts: string[] = [];

  for (const token of raw.split(/\s+/).filter(Boolean)) {
    const match = /^(status|priority|assignee|label|pr|is):(.+)$/i.exec(token);
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
      if (normalized === "idea") parsed.status = "Idea";
      else if (normalized === "planning") parsed.status = "Planning";
      else if (normalized === "approval") parsed.status = "Approval";
      else if (normalized === "ready") parsed.status = "Ready";
      else if (normalized === "inprogress" || normalized === "wip")
        parsed.status = "InProgress";
      else if (normalized === "review" || normalized === "inreview")
        parsed.status = "Review";
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
    } else if (key === "pr") {
      const normalized = value === "no" ? "none" : value;
      if (["open", "merged", "closed", "none"].includes(normalized))
        parsed.pr = normalized;
    }
  }

  parsed.text = textParts.join(" ");
  return parsed;
}

/**
 * The card's PR state for filtering — same priority the TaskCard badge uses:
 * open work beats shipped, shipped beats abandoned. "none" covers tasks with
 * no PR rows at all (prSummary absent or all buckets zero).
 */
function prStateOf(task: TaskItemResponse): string {
  const pr = task.prSummary;
  if (!pr || pr.open + pr.merged + pr.closed === 0) return "none";
  if (pr.open > 0) return "open";
  return pr.merged > 0 ? "merged" : "closed";
}

export function BoardPage() {
  const { t } = useTranslation();
  const COLUMNS = getColumns(t);
  const { workspaceId = "", projectId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // Declared before the hooks that consume them in deps/fetchers.
  const [activityOpen, setActivityOpen] = useState(false);
  // Flips shortly after mount so the heavyweight dep-graph and custom-field
  // fetches start only once the board's first paint is committed.
  const [deferredReady, setDeferredReady] = useState(false);

  const {
    data: project,
    error: projectError,
    reload: reloadProject,
  } = useApi<ProjectResponse>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}`),
    [workspaceId, projectId],
    { snapshotKey: `board:project:${workspaceId}:${projectId}` },
  );
  // Nothing cached and the read failed: the <h1> used to render
  // `project?.name ?? t("common.loading")` forever, so a board whose project
  // fetch 5xx'd sat on "Loading…" with no explanation and no retry.
  const projectFailed = projectError !== null && project === null;

  const { data: members, error: membersError, reload: reloadMembers } = useApi<WorkspaceMemberResponse[]>(
    () => api(`/workspaces/${workspaceId}/members`),
    [workspaceId],
    { snapshotKey: `board:members:${workspaceId}` },
  );

  const {
    data: sprintsRaw,
    error: sprintsError,
    reload: reloadSprints,
  } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/sprints`),
    [workspaceId, projectId],
    { snapshotKey: `board:sprints:${workspaceId}:${projectId}` },
  );
  const sprints = useMemo(
    () => pagedItems<SprintResponse>(sprintsRaw),
    [sprintsRaw],
  );

  const { data: labelsRaw, error: labelsError, reload: reloadLabels } = useApi<unknown>(
    () => api(`/workspaces/${workspaceId}/projects/${projectId}/labels`),
    [workspaceId, projectId],
    { snapshotKey: `board:labels:${workspaceId}:${projectId}` },
  );
  const labels = useMemo(
    () => pagedItems<LabelResponse>(labelsRaw),
    [labelsRaw],
  );
  // Failure with nothing cached: the label list is unknown, so `label:`
  // filters and the label dropdown cannot be evaluated at all.
  const labelsFailed = labelsError !== null && labelsRaw === null;
  const membersFailed = membersError !== null && members === null;

  const {
    data: epics,
    error: epicsError,
    reload: reloadEpics,
  } = useApi<EpicResponse[]>(
    () => getEpics(workspaceId, projectId),
    [workspaceId, projectId],
    { snapshotKey: `board:epics:${workspaceId}:${projectId}` },
  );
  // Column's epic swimlane label falls back to the raw epicId GUID when the
  // list is empty - grouping still works, but lanes read as random hex. The
  // failure must be named, not silently presented as odd lane titles.
  const epicsFailed = epicsError !== null && epics === null;

  // Project-wide dependency graph — the task list response has no isBlocked
  // field, so "blocked" badges/filters derive from these unresolved edges.
  // Deferred past first paint: blocked badges appear moments later and the
  // initial board doesn't wait on this heavyweight graph query.
  const {
    data: depGraph,
    error: depGraphError,
    loading: depGraphLoading,
    reload: reloadDepGraph,
  } = useApi(
    async () =>
      deferredReady ? await getProjectDependencyGraph(workspaceId, projectId) : null,
    [workspaceId, projectId, deferredReady],
    { snapshotKey: `board:depgraph:${workspaceId}:${projectId}` },
  );
  const blockedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    const graph = depGraph;
    if (!graph) return ids;
    if (graph.nodes.some((node) => typeof node.isBlocked === "boolean")) {
      // Fresh payload: the server computed blocked-ness with the exact rule
      // its 409 guard enforces (unresolved non-cyclic blockers, Done and
      // unresolvable blockers exempt). Consume it — client and server can
      // then never disagree about which cards are blocked.
      for (const node of graph.nodes) {
        if (node.isBlocked) ids.add(node.id);
      }
      return ids;
    }
    // Rollout window only: a cached snapshot predating isBlocked. Derive the
    // same rule from edges; an endpoint missing from the snapshot stays
    // treated as unresolved (fail closed until the graph refetches).
    const statusById = new Map(graph.nodes.map((node) => [node.id, node.status]));
    for (const edge of graph.edges) {
      if (edge.isCyclic) continue;
      const blockerStatus = statusById.get(edge.toTaskId);
      if (blockerStatus === undefined || blockerStatus !== "Done") ids.add(edge.fromTaskId);
    }
    return ids;
  }, [depGraph]);
  // While the graph is absent, loading, or the last refresh failed (possibly
  // over a stale snapshot), blocked state is UNKNOWN client-side. The server
  // now rejects blocked moves with 409 (BlockedTaskMoves guards update,
  // reorder and bulk), so pausing here is a UX choice — it stops a drag that
  // is about to fail rather than animating the card and then bouncing it.
  const blockedStateUnknown =
    depGraph === null || depGraphLoading || depGraphError !== null;

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
    { snapshotKey: `board:tasks:${workspaceId}:${projectId}` },
  );

  // /activities returns a PagedResult ({ items, totalCount, ... }), not a
  // flat array — unwrap through pagedItems or ActivityDrawer's activities.map
  // crashes the page ("n.map is not a function").
  // Lazily fetched: the drawer only loads history when actually opened —
  // one fewer heavyweight request on every board mount.
  const {
    data: activitiesRaw,
    error: activitiesError,
    loading: activitiesLoading,
    reload: reloadActivities,
  } = useApi<unknown>(
    () =>
      activityOpen
        ? api(`/workspaces/${workspaceId}/projects/${projectId}/activities`)
        : Promise.resolve(null),
    [workspaceId, projectId, activityOpen],
    { snapshotKey: `board:activities:${workspaceId}:${projectId}` },
  );
  const activities = useMemo(
    // Keep null when the drawer's fetch never resolved — the drawer renders
    // "no activity" for an empty array, and passing `?? []` on a failed
    // first load would launder the error into an empty timeline.
    () => (activitiesRaw === null ? null : pagedItems<ActivityResponse>(activitiesRaw)),
    [activitiesRaw],
  );

  // Custom-field values for the whole project in ONE request. The board used
  // to fire a request per TaskCard (N+1) which made project loads slow — this
  // map is passed down to each Column/Card instead. Deferred past first
  // paint: field chips are secondary content on cards. (Not snapshotted —
  // a Map doesn't survive the JSON round-trip, and being deferred it costs
  // the first paint nothing.)
  const {
    data: customFieldsByTaskId,
    error: customFieldsError,
    reload: reloadCustomFields,
  } = useApi(
    async () =>
      deferredReady ? await getProjectTaskFieldValues(workspaceId, projectId) : null,
    [workspaceId, projectId, deferredReady],
  );
  // The `?? undefined` handoff below used to swallow a failed read into "no
  // field values", silently dropping every custom-field chip off the cards.
  const customFieldsFailed = customFieldsError !== null && customFieldsByTaskId === null;

  const [tasks, setTasks] = useState<TaskItemResponse[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [prFilter, setPrFilter] = useState("");
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
  const [swimlaneMode, setSwimlaneMode] = useState<"none" | "assignee" | "epic">("none");
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

  // One shared toggle for the deferred fetches: flips after the browser has
  // painted, so first paint competes with zero secondary API calls. A short
  // timeout (instead of rAF-only) also avoids firing while the main thread
  // is still churning through the initial board render.
  useEffect(() => {
    setDeferredReady(false);
    const timer = window.setTimeout(() => setDeferredReady(true), 600);
    return () => window.clearTimeout(timer);
  }, [workspaceId, projectId]);

  // Memoised: a fresh object every render would defeat the visibleTasks
  // memo below, re-running all fourteen filters on every keystroke.
  const parsedSearch = useMemo(() => parseSearchQuery(search), [search]);

  // Stable identity for FilterBar (memoised). The inline object literal this
  // replaced was a fresh instance every render, so the memo released on every
  // keystroke and re-ran the chip build and all the option lists for nothing.
  // The page reads `priorityFilter ?? ""` here because the state is nullable
  // while BoardFilterState.priority is a string; keep that normalisation in
  // the memo, not at the render site, or the memo depends on a derived value
  // it cannot name.
  const filterState = useMemo(
    () => ({
      sprint: sprintFilter,
      search,
      priority: priorityFilter ?? "",
      assignee: assigneeFilter,
      label: labelFilter,
      pr: prFilter,
      dueFrom,
      dueTo,
      blockedOnly,
    }),
    [
      sprintFilter,
      search,
      priorityFilter,
      assigneeFilter,
      labelFilter,
      prFilter,
      dueFrom,
      dueTo,
      blockedOnly,
    ],
  );
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
  // `label:<name>` matches by name (case-insensitive, any label whose name
  // contains the token). Falls back to id match so chips cleared from the
  // dropdown still parse; no match → sentinel that filters everything out.
  // While the label LIST is unknown (failed with nothing cached) a match
  // can't be evaluated — the empty id list filters everything out, which is
  // only honest when paired with the "can't filter" notice below.
  const operatorLabelIds = parsedSearch.label
    ? (labels ?? [])
        .filter(
          (label) =>
            label.name.toLowerCase().includes(parsedSearch.label) ||
            label.id.toLowerCase() === parsedSearch.label,
        )
        .map((label) => label.id)
    : [];
  // Search-driven filters that the failed lists make unevaluable. Each one
  // still filters (showing everything would be its own lie), but the board
  // says plainly that the empty result is unknown state, not "no matches".
  const labelFilterUnknown = labelsFailed && parsedSearch.label !== "";
  // `assignee:<name>` resolves through the members roster, so a failed roster
  // turns every hit into the "no-match" sentinel. `assignee:me` is exempt —
  // it resolves through the current user, who is never missing.
  const assigneeFilterUnknown =
    membersFailed &&
    parsedSearch.assignee !== "" &&
    parsedSearch.assignee !== "me";
  const blockedFilterUnknown =
    blockedStateUnknown && (blockedOnly || parsedSearch.blockedOnly);

  // Fourteen filters over the full task list. Without memoisation this chain
  // re-runs on every render — including keystrokes that only touch selection
  // or an open drawer — and it feeds both the page slice and the Ctrl+A
  // shortcut, so a fresh array also re-binds that listener each time.
  const visibleTasks = useMemo(
    () =>
      tasks
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
        .filter((task) => {
          if (!dueFrom && !dueTo) return true;
          if (!task.dueDateUtc) return false;
          const due = new Date(task.dueDateUtc).getTime();
          if (dueFrom && due < new Date(`${dueFrom}T00:00:00`).getTime()) return false;
          if (dueTo && due > new Date(`${dueTo}T23:59:59`).getTime()) return false;
          return true;
        })
        // Blocked state is derived from the dependency graph (unresolved edges) —
        // the task list response has no isBlocked field.
        .filter((task) => (blockedOnly ? blockedTaskIds.has(task.id) : true))
        // Subtask rows carry no labelIds; the board list always does.
        .filter((task) =>
          labelFilter ? (task.labelIds ?? []).includes(labelFilter) : true,
        )
        .filter((task) =>
          parsedSearch.label
            ? (task.labelIds ?? []).some((id) => operatorLabelIds.includes(id))
            : true,
        )
        .filter((task) => (prFilter ? prStateOf(task) === prFilter : true))
        .filter((task) =>
          parsedSearch.pr ? prStateOf(task) === parsedSearch.pr : true,
        )
        .filter((task) =>
          parsedSearch.status ? task.status === parsedSearch.status : true,
        )
        .filter((task) =>
          parsedSearch.priority ? task.priority === parsedSearch.priority : true,
        )
        .filter((task) =>
          operatorAssigneeId ? task.assigneeId === operatorAssigneeId : true,
        )
        .filter((task) => (parsedSearch.blockedOnly ? blockedTaskIds.has(task.id) : true))
        .filter((task) =>
          parsedSearch.text
            ? task.title.toLowerCase().includes(parsedSearch.text.toLowerCase())
            : true,
        ),
    [
      tasks,
      sprintFilter,
      priorityFilter,
      assigneeFilter,
      dueFrom,
      dueTo,
      blockedOnly,
      blockedTaskIds,
      labelFilter,
      operatorLabelIds,
      prFilter,
      parsedSearch,
      operatorAssigneeId,
    ],
  );

  const pageCount = Math.max(1, Math.ceil(visibleTasks.length / TASKS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pagedTasks = useMemo(
    () =>
      visibleTasks.slice(
        (safePage - 1) * TASKS_PER_PAGE,
        safePage * TASKS_PER_PAGE,
      ),
    [visibleTasks, safePage],
  );

  // One array per column, memoised: Column's `shown` windowing and swimlane
  // partition both depend on the `tasks` prop by identity, so an inline
  // `.filter()` here (a fresh array every render) would invalidate both on
  // every keystroke and re-slice/re-partition all columns for nothing.
  // The status list comes from COLUMNS' contents (a fixed literal set);
  // COLUMNS itself is a fresh array per render so it stays out of the deps.
  const tasksByStatus = useMemo(() => {
    const byStatus = new Map<string, TaskItemResponse[]>();
    for (const { status } of COLUMNS) byStatus.set(status, []);
    for (const task of pagedTasks) {
      const list = byStatus.get(task.status);
      if (list) list.push(task);
    }
    return byStatus;
  }, [pagedTasks]);

  // TaskDetailPanel is memoised; its sprint dropdown reads this list, so an
  // inline `(sprints ?? []).filter(...)` at the render site would hand it a
  // fresh array every render and re-run the whole panel body per keystroke.
  const panelSprints = useMemo(
    () => (sprints ?? []).filter((s) => s.status !== "Completed"),
    [sprints],
  );

  useEffect(() => {
    setPage(1);
  }, [sprintFilter, search, priorityFilter, assigneeFilter, labelFilter, prFilter, dueFrom, dueTo, blockedOnly]);

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

  // Saved-search handoff from the command palette (?fs=<json>). The palette
  // targets lastBoardPath first, so when the user is ALREADY on this board
  // the navigation only swaps the query — the route does not remount. With
  // the old `[]` deps the closure kept the mount-time fsParam (null), the
  // effect never re-ran, and the saved search was silently dropped with
  // `?fs=` dead in the URL. Keying on fsParam fires it on every handoff;
  // stripping the param below flips fsParam back to null, and the early
  // return keeps that pass inert.
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
    // fsParam is the only dependency that matters; the setters below are
    // useState/setSearchParams identities that never change.
  }, [fsParam, setSearchParams]);

  // Keyboard shortcuts: n=new, / or f=focus filter, ?=help,
  // Ctrl+A=select visible, Delete=bulk delete, Esc=step back.
  // The bare-character ones honor the Settings → General turn-off
  // required by WCAG 2.1.4; modifier chords and Delete/Esc are exempt.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        // Typing in a field must not fire shortcuts. The exception is
        // Escape while the detail drawer is open: its title and comment
        // fields live inside the dialog, and closing the dialog has to
        // stay reachable from them.
        if (!(event.key === "Escape" && selectedTaskId)) return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key.toLowerCase() === "a" && !selectedTaskId) {
          event.preventDefault();
          setSelectedIds(new Set(visibleTasks.map((t) => t.id)));
        }
        return;
      }

      switch (event.key) {
        case "n":
          if (!areCharacterShortcutsEnabled()) break;
          if (!creating && !selectedTaskId && !graphOpen && !helpOpen)
            setCreating(true);
          break;
        case "/":
        case "f": {
          if (!areCharacterShortcutsEnabled()) break;
          event.preventDefault();
          document
            .querySelector<HTMLInputElement>("input[data-board-search]")
            ?.focus();
          break;
        }
        case "?":
          if (!areCharacterShortcutsEnabled()) break;
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
          // The activity drawer renders above the detail drawer, so while
          // both are open it takes the keystroke first.
          else if (activityOpen) setActivityOpen(false);
          // The open drawer is the topmost focused surface when no modal is
          // up, so it closes before the selection-clearing branch can eat
          // the keystroke.
          else if (selectedTaskId) setSelectedTaskId(null);
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
    activityOpen,
    visibleTasks,
  ]);

  // Stable identities: TaskCard is memoised and these are props on it, so a
  // fresh function per render would re-run every visible card's body on every
  // keystroke. The setState updater already closes over nothing that changes.
  const toggleSelect = useCallback((taskId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleSelectAllInColumn = useCallback(
    (status: TaskItemResponse["status"], select: boolean) => {
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
    },
    [visibleTasks],
  );

  // Stable identity for the per-column drop handler. Column is memoised, so an
  // inline arrow at the render site (wrapping moveTask) is a fresh function
  // every render and releases the memo for nothing. moveTask is a plain inner
  // function — it reads tasks/blockedTaskIds/t by closure — so the callback
  // must list those closures as deps. The guard inside moveTask is unchanged;
  // only the wrapper's identity is memoised.
  const handleDropTask = useCallback(
    (taskId: string, status: TaskItemResponse["status"], beforeTaskId?: string | null) => {
      void moveTask(taskId, status, beforeTaskId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moveTask closes
    // over tasks/blockedStateUnknown/blockedTaskIds/t/push; listing the
    // function itself is not possible, so its closure inputs are named.
    [tasks, blockedStateUnknown, blockedTaskIds, t, push],
  );

  // Stable identity: Column is memoised and takes this as its per-column
  // select-all handler. An inline arrow binding `status` at the render site
  // would be a fresh function every render and release the memo for nothing,
  // so the memoised handler is built per status inside the map below.
  const makeSelectAllInColumn = useCallback(
    (status: TaskItemResponse["status"]) =>
      (select: boolean) => handleSelectAllInColumn(status, select),
    [handleSelectAllInColumn],
  );

  // Stable identities: TaskDetailPanel is memoised and takes these as props.
  // An inline arrow at the render site is a fresh function every render, so
  // the memo would hold for no keystroke. The setState updater closes over
  // nothing that changes, and reload/reloadSprints come from useApi (stable).
  const closeDetailPanel = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleTaskChanged = useCallback(() => {
    reload();
    reloadSprints();
  }, [reload, reloadSprints]);

  // Stable identity: FilterBar is memoised and takes this as its change
  // handler. An inline arrow at the render site is a fresh function every
  // render, so the memo would hold for no keystroke. The nine setters are all
  // useState identities (stable for the lifetime of the page), so the dep list
  // is empty by construction rather than by omission.
  const handleFilterChange = useCallback(
    (patch: Partial<BoardFilterState>) => {
      if (patch.sprint !== undefined) setSprintFilter(patch.sprint);
      if (patch.search !== undefined) setSearch(patch.search);
      if (patch.priority !== undefined)
        setPriorityFilter(patch.priority === "" ? null : patch.priority);
      if (patch.assignee !== undefined) setAssigneeFilter(patch.assignee);
      if (patch.label !== undefined) setLabelFilter(patch.label);
      if (patch.pr !== undefined) setPrFilter(patch.pr);
      if (patch.dueFrom !== undefined) setDueFrom(patch.dueFrom);
      if (patch.dueTo !== undefined) setDueTo(patch.dueTo);
      if (patch.blockedOnly !== undefined) setBlockedOnly(patch.blockedOnly);
    },
    [
      setSprintFilter,
      setSearch,
      setPriorityFilter,
      setAssigneeFilter,
      setLabelFilter,
      setPrFilter,
      setDueFrom,
      setDueTo,
      setBlockedOnly,
    ],
  );

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

  const handleEstimationSaved = useCallback(
    (_taskId: string, _storyPoints: number | null) => {
      reload();
    },
    [reload],
  );

  // Live updates: any change made by anyone in this project triggers a
  // debounced refetch, so open boards stay in sync across browsers.
  useEffect(() => {
    if (!projectId) return;

    const connection = createProjectConnection(projectId);
    // Shared with usePresence: both consumers of this board's hub connection
    // hold one ref so the socket survives either one unmounting alone.
    retainProjectConnection(projectId);
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
      // This handler would outlive the component if the socket survives this
      // unmount (usePresence still holds it) — unregister it before releasing.
      connection.off("project-event", scheduleReload);
      // Release only — never stop directly. usePresence shares this socket;
      // stopping here would kill the board's presence for the other consumer.
      void releaseProjectConnection(projectId);
    };
  }, [projectId, reload, reloadSprints, reloadActivities]);

  async function moveTask(
    taskId: string,
    status: TaskItemResponse["status"],
    beforeTaskId?: string | null,
  ) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || (!beforeTaskId && task.status === status)) return;

    // Fail closed while the graph is unknown. The server now rejects blocked
    // cross-status moves with 409, so this guard is a UX choice: without a
    // fresh graph we cannot tell blocked from clear, so pausing the drag
    // beats animating a move that is about to bounce off the server.
    // Same-column reorders are unaffected because they change no status.
    if (task.status !== status && blockedStateUnknown) {
      setBoardError(t("board.blockedStateLoadFailed"));
      push(t("board.couldntMoveTask"), "error");
      return;
    }

    if (blockedTaskIds.has(taskId) && task.status !== status) {
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
      // Mirror the server's review stamp so the aging chip reads "0m" right
      // after a drop into Review instead of waiting for the reload.
      enteredReviewAtUtc:
        status === "Review" && task.status !== "Review"
          ? new Date().toISOString()
          : task.enteredReviewAtUtc,
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
      // Placeholder key until the server row reconciles (number not yet known).
      key: "—",
      number: 0,
      title: input.title,
      description: input.description,
      status: "Idea",
      priority: input.priority,
      assigneeId: null,
      sprintId: null,
      epicId: null,
      parentTaskId: null,
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
                {project?.name ??
                  (projectFailed ? t("board.projectNameUnavailable") : t("common.loading"))}
              </h1>
              {project && <Badge tone="teal">{project.key}</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("board.dragHint")}
            </p>
          </div>
            <div className="flex w-full min-w-0 flex-col gap-2">
            {/* Presence + project tools trigger share one line; the full tool
                list lives in the hover/click popover so the header stays
                compact on every viewport. */}
            <div className="flex min-w-0 items-center gap-2">
              <div className="shrink-0">
                <BoardPresence
                  users={presenceUsers}
                  remainingCount={presenceRemaining}
                  totalOnline={presenceTotal}
                />
              </div>
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
                <span className="hidden xs:inline sm:inline">{t("board.dependencyGraph")}</span>
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
              <div className="flex items-center gap-1.5">
                <span className="hidden text-xs text-muted-foreground sm:inline">{t("board.swimlaneGroupBy")}</span>
                <select
                  aria-label={t("board.swimlane")}
                  value={swimlaneMode}
                  onChange={(e) => setSwimlaneMode(e.target.value as "none" | "assignee" | "epic")}
                  className="rounded-lg border border-border bg-card px-2 py-1.5 text-xs transition-colors duration-200 focus:border-primary focus:outline-none"
                >
                  <option value="none">{t("board.swimlaneNone")}</option>
                  <option value="assignee">{t("board.swimlaneByAssignee")}</option>
                  <option value="epic">{t("board.swimlaneByEpic")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 transition-colors duration-200 focus-within:border-primary">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("board.filterTasks")}
                data-board-search
                aria-label={t("board.filterSearchHint")}
                className="w-16 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none sm:w-44"
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

        {projectFailed && (
          // The h1 can't say "Loading..." forever when the fetch already
          // failed - name it and offer the retry, matching the sprints block.
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert
                  id="boardpage-project-error"
                  message={t("board.projectLoadFailed")}
                />
              </div>
              <Button size="sm" variant="outline" onClick={reloadProject}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {membersFailed && (
          // The roster drives `isAdmin`, so a failed read demotes an Owner to
          // a bystander: Import vanishes, SprintBar loses its edit controls,
          // and the assignee filter goes unevaluable. The FilterBar retry
          // only renders while the assignee dropdown is visible (and the
          // keyboard "?" hint names the missing list only when a search is
          // typed), so the board itself must name the failure and offer the
          // reload - outside every gate the error disables.
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert
                  id="boardpage-members-error"
                  message={t("board.membersLoadFailed")}
                />
              </div>
              <Button size="sm" variant="outline" onClick={reloadMembers}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {epicsFailed && swimlaneMode === "epic" && (
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert
                  id="boardpage-epics-error"
                  message={t("board.epicsLoadFailed")}
                />
              </div>
              <Button size="sm" variant="outline" onClick={reloadEpics}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {customFieldsFailed && (
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert
                  id="boardpage-customfields-error"
                  message={t("board.customFieldsLoadFailed")}
                />
              </div>
              <Button size="sm" variant="outline" onClick={reloadCustomFields}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {sprintsError && sprintsRaw === null ? (
          // pagedItems gives an empty array on failure, which SprintBar would
          // happily render as "no sprints" — indistinguishable from the truth.
          // Show the failure and a retry instead.
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert message={t("board.sprintsLoadFailed")} />
              </div>
              <Button size="sm" variant="outline" onClick={reloadSprints}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        ) : (
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
          members={members ?? EMPTY_MEMBERS}
          labels={labels ?? EMPTY_LABELS}
          membersFailed={membersFailed}
          onRetryMembers={reloadMembers}
          labelsFailed={labelsFailed}
          onRetryLabels={reloadLabels}
          blockedUnknown={blockedStateUnknown}
          current={filterState}
          onChange={handleFilterChange}
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

        {depGraphError !== null && (
          // Say up front why cross-status drags are refusing to run instead
          // of letting each drop fail mysteriously through the moveTask gate.
          <div className="mb-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert message={t("board.blockedStateLoadFailed")} />
              </div>
              <Button size="sm" variant="outline" onClick={reloadDepGraph}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {blockedFilterUnknown && !(depGraphError !== null) && (
          // The graph is merely absent/loading (not errored), yet a
          // blocked-only filter is active — say the result is unknowable
          // rather than presenting it as "no blocked tasks".
          <div className="mb-4">
            <ErrorAlert message={t("board.blockedFilterUnknown")} />
          </div>
        )}

        {labelFilterUnknown && (
          <div className="mb-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert message={t("board.labelFilterUnknown")} />
              </div>
              <Button size="sm" variant="outline" onClick={reloadLabels}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {assigneeFilterUnknown && (
          <div className="mb-4">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <ErrorAlert message={t("board.assigneeFilterUnknown")} />
              </div>
              <Button size="sm" variant="outline" onClick={reloadMembers}>
                {t("common.retry")}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-4 lg:flex-row">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 flex-1" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <ErrorAlert id="boardpage-tasks-error" message={error} />
            </div>
            <Button size="sm" variant="outline" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
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
            <div className="flex flex-col gap-4 pb-4 lg:flex-row lg:flex-wrap lg:items-stretch">
              {COLUMNS.map(({ title, status }, index) => (
                <div
                  key={status}
                  className="rise flex min-w-0 flex-1 flex-col lg:min-w-[280px] lg:flex-1"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <Column
                    title={title}
                    status={status}
                    tasks={tasksByStatus.get(status) ?? EMPTY_TASKS}
                    members={members ?? EMPTY_MEMBERS}
                    epics={epics ?? EMPTY_EPICS}
                    swimlaneMode={swimlaneMode}
                    customFieldsByTaskId={customFieldsByTaskId ?? undefined}
                    blockedTaskIds={blockedTaskIds}
                    onDropTask={handleDropTask}
                    onDelete={setPendingDelete}
                    onSelect={setSelectedTaskId}
                    selectionMode={selectedIds.size > 0}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    onSelectAllInColumn={makeSelectAllInColumn(status)}
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
          <div
            role="toolbar"
            aria-label={t("board.bulkActions")}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
          >
            <span
              aria-live="polite"
              className="rounded-md bg-primary/15 px-2 py-1 font-mono text-xs font-semibold text-primary-strong"
            >
              {t("board.selectedCount", { count: selectedIds.size })}
            </span>
            <select
              aria-label={t("board.bulkMoveToStatus")}
              value={bulkStatus}
              disabled={blockedStateUnknown}
              title={blockedStateUnknown ? t("board.bulkBlockedStateLoadFailed") : undefined}
              onChange={(event) => {
                const status = event.target.value;
                setBulkStatus(status);
                if (!status) return;
                // The 409 from the server is the authoritative gate, but a
                // bulk call is all-or-nothing: one blocked selection
                // bounces the whole batch, so name the offenders before
                // sending anything.
                if (blockedStateUnknown) {
                  setBoardError(t("board.bulkBlockedStateLoadFailed"));
                  return;
                }
                const offenders = [...selectedIds].filter((id) => blockedTaskIds.has(id));
                if (offenders.length > 0) {
                  const title = tasks.find((task) => task.id === offenders[0])?.title ?? offenders[0];
                  setBoardError(
                    offenders.length === 1
                      ? t("board.blockedMoveDetail", { title })
                      : t("board.bulkBlockedMoveDetail", { count: offenders.length }),
                  );
                  return;
                }
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
            reloadDepGraph();
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
          members={members ?? EMPTY_MEMBERS}
          sprints={panelSprints}
          allTasks={tasks}
          workspaceId={workspaceId}
          projectId={projectId}
          onClose={closeDetailPanel}
          onTaskChanged={handleTaskChanged}
        />
      )}

      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={activities}
        loading={activitiesLoading}
        error={activitiesError}
        onRetry={reloadActivities}
      />
    </AppShell>
  );
}
