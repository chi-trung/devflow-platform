import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Search, X } from "lucide-react";
import {
  addTaskDependency,
  getProjectDependencyGraph,
  getTaskDependencies,
  removeTaskDependency,
} from "../../lib/api";
import type {
  ProjectDependencyGraphResponse,
  TaskItemResponse,
} from "../../types/api";

const NODE_W = 186;
const NODE_H = 48;
const COL_GAP = 250;
const ROW_GAP = 18;
const PAD_X = 28;
const PAD_TOP = 46;
const PAD_BOTTOM = 28;

const COLUMNS: TaskItemResponse["status"][] = [
  "Backlog",
  "InProgress",
  "InReview",
  "Done",
];

const STATUS_LABEL_KEYS: Record<TaskItemResponse["status"], string> = {
  Backlog: "task.backlogStatus",
  InProgress: "task.inProgressStatus",
  InReview: "task.inReviewStatus",
  Done: "task.doneStatus",
};

type Direction = "blockers" | "blockedBy";

interface PositionedNode {
  task: TaskItemResponse;
  x: number;
  y: number;
}

/** A dependency row: `blockerTaskId` must be Done before `blockedTaskId` can move. */
interface Dependency {
  blockedTaskId: string;
  blockerTaskId: string;
  isCyclic: boolean;
}

interface LaidOutEdge {
  key: string;
  blockedTaskId: string;
  blockerTaskId: string;
  blockerTitle: string;
  blockedTitle: string;
  path: string;
  midX: number;
  midY: number;
  cyclic: boolean;
}

function columnIndexFor(status: string): number {
  const index = COLUMNS.indexOf(status as TaskItemResponse["status"]);
  return index === -1 ? 0 : index;
}

function findCycleNodes(adjacency: Map<string, string[]>): Set<string> {
  const state = new Map<string, 1 | 2>();
  const cyclic = new Set<string>();

  function visit(id: string, stack: string[]): void {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      const start = stack.indexOf(id);
      if (start >= 0) {
        for (const n of stack.slice(start)) cyclic.add(n);
      }
      return;
    }
    state.set(id, 1);
    for (const next of adjacency.get(id) ?? []) {
      visit(next, [...stack, id]);
    }
    state.set(id, 2);
  }

  for (const id of adjacency.keys()) visit(id, []);
  return cyclic;
}

/** Curved connector between two nodes plus the midpoint used for the edge control. */
function connector(
  from: PositionedNode,
  to: PositionedNode,
): { path: string; midX: number; midY: number } {
  const fromCol = Math.round((from.x - PAD_X) / COL_GAP);
  const toCol = Math.round((to.x - PAD_X) / COL_GAP);
  const y1 = from.y + NODE_H / 2;
  const y2 = to.y + NODE_H / 2;

  let x1: number;
  let x2: number;
  let c1x: number;
  let c2x: number;

  if (fromCol === toCol) {
    // Same column: loop out to the right of the column and back in.
    x1 = from.x + NODE_W;
    x2 = to.x + NODE_W;
    const bulge = 46 + Math.min(60, Math.abs(y2 - y1) / 3);
    c1x = x1 + bulge;
    c2x = x2 + bulge;
  } else if (toCol > fromCol) {
    x1 = from.x + NODE_W;
    x2 = to.x;
    const bulge = Math.max(44, (x2 - x1) / 2);
    c1x = x1 + bulge;
    c2x = x2 - bulge;
  } else {
    x1 = from.x;
    x2 = to.x + NODE_W;
    const bulge = Math.max(44, (x1 - x2) / 2);
    c1x = x1 - bulge;
    c2x = x2 + bulge;
  }

  return {
    path: `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`,
    // Cubic Bézier value at t = 0.5.
    midX: (x1 + 3 * c1x + 3 * c2x + x2) / 8,
    midY: (y1 + 3 * y1 + 3 * y2 + y2) / 8,
  };
}

interface GraphModalProps {
  tasks: TaskItemResponse[];
  workspaceId: string;
  projectId: string;
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
  /** Called after a dependency is created or removed so the board can refresh. */
  onDependencyChanged?: () => void;
}

export function GraphModal({
  tasks,
  workspaceId,
  projectId,
  onSelectTask,
  onClose,
  onDependencyChanged,
}: GraphModalProps) {
  const { t } = useTranslation();
  const [graph, setGraph] = useState<ProjectDependencyGraphResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<Direction>("blockers");
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dragSourceRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const loadGraph = useCallback(async () => {
    try {
      const result = await getProjectDependencyGraph(workspaceId, projectId);
      if (!cancelledRef.current) {
        setGraph(result);
        setLoadError(null);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setLoadError(
          err instanceof Error ? err.message : t("dependency.failedToLoad"),
        );
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [workspaceId, projectId, t]);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    void loadGraph();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadGraph]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (linkSourceId) {
        setLinkSourceId(null);
        return;
      }
      // Escape inside the filter clears it first instead of closing the modal.
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && target.value) {
        setQuery("");
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [linkSourceId, onClose]);

  // Board tasks are the primary source; graph nodes fill in tasks that take
  // part in a dependency but are not currently loaded on the board.
  const allTasks = useMemo(() => {
    const byId = new Map<string, TaskItemResponse>();
    for (const task of tasks) byId.set(task.id, task);
    for (const node of graph?.nodes ?? []) {
      if (byId.has(node.id)) continue;
      byId.set(node.id, {
        id: node.id,
        projectId: node.projectId,
        title: node.title,
        description: null,
        status: COLUMNS[columnIndexFor(node.status)],
        priority: "Medium",
        assigneeId: node.assigneeId,
        sprintId: null,
        dueDateUtc: null,
        completedAtUtc: null,
      });
    }
    return [...byId.values()];
  }, [tasks, graph]);

  const dependencies = useMemo<Dependency[]>(
    () =>
      (graph?.edges ?? []).map((edge) => ({
        // Backend edge: `from` = blocked task, `to` = blocker task.
        blockedTaskId: edge.fromTaskId,
        blockerTaskId: edge.toTaskId,
        isCyclic: edge.isCyclic,
      })),
    [graph],
  );

  const cyclicIds = useMemo(() => {
    const ids = new Set(graph?.cyclicNodeIds ?? []);
    const adjacency = new Map<string, string[]>();
    for (const dep of dependencies) {
      const blockers = adjacency.get(dep.blockedTaskId) ?? [];
      blockers.push(dep.blockerTaskId);
      adjacency.set(dep.blockedTaskId, blockers);
    }
    for (const id of findCycleNodes(adjacency)) ids.add(id);
    return ids;
  }, [graph, dependencies]);

  const needle = query.trim().toLowerCase();

  const blockerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dep of dependencies) {
      counts.set(dep.blockedTaskId, (counts.get(dep.blockedTaskId) ?? 0) + 1);
    }
    return counts;
  }, [dependencies]);

  const layout = useMemo(() => {
    const visible = needle
      ? allTasks.filter((task) => task.title.toLowerCase().includes(needle))
      : allTasks;

    const byColumn: TaskItemResponse[][] = COLUMNS.map(() => []);
    for (const task of visible) byColumn[columnIndexFor(task.status)].push(task);

    const nodes = new Map<string, PositionedNode>();
    let maxRows = 1;
    byColumn.forEach((list, columnIndex) => {
      maxRows = Math.max(maxRows, list.length);
      list.forEach((task, rowIndex) => {
        nodes.set(task.id, {
          task,
          x: PAD_X + columnIndex * COL_GAP,
          y: PAD_TOP + rowIndex * (NODE_H + ROW_GAP),
        });
      });
    });

    const edges: LaidOutEdge[] = [];
    for (const dep of dependencies) {
      const blocked = nodes.get(dep.blockedTaskId);
      const blocker = nodes.get(dep.blockerTaskId);
      if (!blocked || !blocker) continue;

      // "Blockers" points blocker → blocked; "Blocked by" reverses the arrow.
      const [from, to] =
        direction === "blockers" ? [blocker, blocked] : [blocked, blocker];
      const { path, midX, midY } = connector(from, to);
      edges.push({
        key: `${dep.blockedTaskId}:${dep.blockerTaskId}`,
        blockedTaskId: dep.blockedTaskId,
        blockerTaskId: dep.blockerTaskId,
        blockerTitle: blocker.task.title,
        blockedTitle: blocked.task.title,
        path,
        midX,
        midY,
        cyclic:
          dep.isCyclic ||
          (cyclicIds.has(dep.blockedTaskId) && cyclicIds.has(dep.blockerTaskId)),
      });
    }

    return {
      nodes: [...nodes.values()],
      edges,
      counts: byColumn.map((list) => list.length),
      width: PAD_X * 2 + (COLUMNS.length - 1) * COL_GAP + NODE_W,
      height: PAD_TOP + maxRows * (NODE_H + ROW_GAP) + PAD_BOTTOM,
    };
  }, [allTasks, dependencies, cyclicIds, direction, needle]);

  const linkSourceTitle =
    allTasks.find((task) => task.id === linkSourceId)?.title ?? "";

  const createDependency = useCallback(
    async (blockerTaskId: string, blockedTaskId: string) => {
      setLinkSourceId(null);
      if (!blockerTaskId || !blockedTaskId || blockerTaskId === blockedTaskId) {
        return;
      }
      setActionError(null);
      setBusy(true);
      try {
        await addTaskDependency(
          workspaceId,
          projectId,
          blockedTaskId,
          blockerTaskId,
        );
        await loadGraph();
        onDependencyChanged?.();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : t("dependency.failedToAdd"),
        );
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, projectId, loadGraph, onDependencyChanged, t],
  );

  const deleteDependency = useCallback(
    async (blockedTaskId: string, blockerTaskId: string) => {
      setActionError(null);
      setBusy(true);
      try {
        // The graph edge has no dependency id, so resolve it on the blocked task.
        const deps = await getTaskDependencies(
          workspaceId,
          projectId,
          blockedTaskId,
        );
        const match = deps.find((dep) => dep.blockerTaskId === blockerTaskId);
        if (!match) throw new Error(t("dependency.failedToRemove"));
        await removeTaskDependency(
          workspaceId,
          projectId,
          blockedTaskId,
          match.id,
        );
        await loadGraph();
        onDependencyChanged?.();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : t("dependency.failedToRemove"),
        );
      } finally {
        setBusy(false);
      }
    },
    [workspaceId, projectId, loadGraph, onDependencyChanged, t],
  );

  function handleNodeActivate(taskId: string) {
    if (linkSourceId && linkSourceId !== taskId) {
      void createDependency(linkSourceId, taskId);
      return;
    }
    if (linkSourceId === taskId) {
      setLinkSourceId(null);
      return;
    }
    onSelectTask(taskId);
    onClose();
  }

  const statusMessage = linkSourceId
    ? t("graph.linkingFrom", { title: linkSourceTitle })
    : (actionError ?? "");

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t("graph.aria")}
    >
      <button
        type="button"
        aria-label={t("graph.closeGraphAria")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/30"
      />
      <div className="absolute left-1/2 top-1/2 flex max-h-[90vh] w-[min(96vw,1180px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <h2 className="font-display text-base font-semibold">
            {t("board.dependencyGraph")}
          </h2>

          <label className="relative ml-auto">
            <span className="sr-only">{t("graph.filterAria")}</span>
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("graph.filterPlaceholder")}
              className="w-52 rounded-md border border-border bg-card py-1.5 pl-7 pr-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
          </label>

          <div
            role="group"
            aria-label={t("graph.directionAria")}
            className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5"
          >
            {(["blockers", "blockedBy"] as Direction[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDirection(value)}
                aria-pressed={direction === value}
                className={`rounded px-2 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150 ${
                  direction === value
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {value === "blockers"
                  ? t("graph.blockersView")
                  : t("graph.blockedByView")}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t("graph.closeAria")}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <p
          aria-live="polite"
          className={`px-4 text-xs ${
            actionError ? "text-destructive" : "text-primary"
          } ${statusMessage ? "pt-2" : ""}`}
        >
          {statusMessage}
          {linkSourceId && (
            <button
              type="button"
              onClick={() => setLinkSourceId(null)}
              className="ml-2 font-medium underline hover:no-underline"
            >
              {t("common.cancel")}
            </button>
          )}
        </p>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("graph.loadingDeps")}
            </p>
          ) : loadError ? (
            <p className="p-8 text-center text-sm text-destructive">
              {loadError}
            </p>
          ) : allTasks.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("graph.noTasks")}
            </p>
          ) : layout.nodes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("graph.noMatches")}
            </p>
          ) : (
            <div
              className="relative"
              style={{ width: layout.width, height: layout.height }}
            >
              <svg
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={layout.width}
                height={layout.height}
                aria-hidden
              >
                <defs>
                  <marker
                    id="graph-arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--color-border-strong)" />
                  </marker>
                  <marker
                    id="graph-arrow-cyclic"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--color-destructive)" />
                  </marker>
                </defs>
                {layout.edges.map((edge) => (
                  <path
                    key={edge.key}
                    d={edge.path}
                    fill="none"
                    stroke={
                      edge.cyclic
                        ? "var(--color-destructive)"
                        : "var(--color-border-strong)"
                    }
                    strokeWidth={edge.cyclic ? 2 : 1.5}
                    markerEnd={`url(#${
                      edge.cyclic ? "graph-arrow-cyclic" : "graph-arrow"
                    })`}
                  />
                ))}
              </svg>

              {COLUMNS.map((status, index) => (
                <div
                  key={status}
                  className="absolute flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                  style={{
                    left: PAD_X + index * COL_GAP,
                    top: 8,
                    width: NODE_W,
                  }}
                >
                  {t(STATUS_LABEL_KEYS[status])}
                  <span className="rounded bg-elevated px-1 py-0.5 text-[10px]">
                    {layout.counts[index]}
                  </span>
                </div>
              ))}

              {layout.edges.map((edge) => (
                <button
                  key={`del-${edge.key}`}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void deleteDependency(edge.blockedTaskId, edge.blockerTaskId)
                  }
                  aria-label={t("graph.removeEdgeAria", {
                    blocker: edge.blockerTitle,
                    blocked: edge.blockedTitle,
                  })}
                  title={t("graph.removeEdgeAria", {
                    blocker: edge.blockerTitle,
                    blocked: edge.blockedTitle,
                  })}
                  className="absolute z-10 flex size-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground opacity-50 transition-all duration-150 hover:border-destructive hover:text-destructive hover:opacity-100 focus-visible:border-destructive focus-visible:opacity-100 focus-visible:outline-none disabled:opacity-30"
                  style={{ left: edge.midX, top: edge.midY }}
                >
                  <X className="size-2.5" aria-hidden />
                </button>
              ))}

              {layout.nodes.map(({ task, x, y }) => {
                const isCyclic = cyclicIds.has(task.id);
                const isLinkSource = linkSourceId === task.id;
                const blockerCount = blockerCounts.get(task.id) ?? 0;

                return (
                  <div
                    key={task.id}
                    data-task-id={task.id}
                    data-drop-target="false"
                    draggable
                    onDragStart={(event) => {
                      dragSourceRef.current = task.id;
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "link";
                    }}
                    onDragEnd={() => {
                      dragSourceRef.current = null;
                    }}
                    onDragOver={(event) => {
                      if (
                        !dragSourceRef.current ||
                        dragSourceRef.current === task.id
                      ) {
                        return;
                      }
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "link";
                      event.currentTarget.dataset.dropTarget = "true";
                    }}
                    onDragLeave={(event) => {
                      event.currentTarget.dataset.dropTarget = "false";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.currentTarget.dataset.dropTarget = "false";
                      const blockerTaskId =
                        event.dataTransfer.getData("text/plain") ||
                        dragSourceRef.current ||
                        "";
                      dragSourceRef.current = null;
                      void createDependency(blockerTaskId, task.id);
                    }}
                    className={`group absolute flex items-stretch rounded-lg bg-card shadow-sm transition-colors duration-150 data-[drop-target=true]:border-primary data-[drop-target=true]:bg-primary/10 ${
                      isCyclic
                        ? "border-2 border-destructive"
                        : isLinkSource
                          ? "border-2 border-primary"
                          : "border border-border"
                    }`}
                    style={{
                      left: x,
                      top: y,
                      width: NODE_W,
                      height: NODE_H,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleNodeActivate(task.id)}
                      aria-label={
                        linkSourceId && linkSourceId !== task.id
                          ? t("graph.dropTargetAria", {
                              blocker: linkSourceTitle,
                              blocked: task.title,
                            })
                          : t("graph.openTaskAria", { title: task.title })
                      }
                      className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <span className="line-clamp-2 text-xs font-medium text-foreground">
                        {task.title}
                      </span>
                      {(blockerCount > 0 || isCyclic) && (
                        <span
                          className={`font-mono text-[10px] ${
                            isCyclic ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {isCyclic
                            ? `⚠ ${t("graph.circularDep")}`
                            : t("graph.blockerCount", { count: blockerCount })}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setLinkSourceId((current) =>
                          current === task.id ? null : task.id,
                        )
                      }
                      aria-pressed={isLinkSource}
                      aria-label={t("graph.linkFromAria", { title: task.title })}
                      title={t("graph.linkFromAria", { title: task.title })}
                      className={`flex w-6 shrink-0 items-center justify-center rounded-r-lg border-l border-border/60 text-muted-foreground opacity-0 transition-all duration-150 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 focus-visible:outline-none group-hover:opacity-100 disabled:opacity-30 ${
                        isLinkSource ? "bg-primary/15 text-primary opacity-100" : ""
                      }`}
                    >
                      <Link2 className="size-3" aria-hidden />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
          <span>
            {direction === "blockers"
              ? t("graph.arrowBlocks")
              : t("graph.arrowBlockedBy")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm border-2 border-destructive"
              aria-hidden
            />
            {t("graph.circularDep")}
          </span>
          <span>{t("graph.dragHint")}</span>
          <span className="ml-auto">
            {t("graph.taskCount", {
              shown: layout.nodes.length,
              total: allTasks.length,
            })}
          </span>
        </footer>
      </div>
    </div>
  );
}
