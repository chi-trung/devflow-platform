import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { getTaskDependencies } from "../../lib/api";
import type { TaskDependencyResponse, TaskItemResponse } from "../../types/api";

const NODE_W = 132;
const NODE_H = 34;
const COL_GAP = 190;
const ROW_GAP = 12;
const PAD = 24;

const COLUMNS: { status: TaskItemResponse["status"]; label: string }[] = [
  { status: "Backlog", label: "Backlog" },
  { status: "InProgress", label: "In Progress" },
  { status: "InReview", label: "In Review" },
  { status: "Done", label: "Done" },
];

interface PositionedNode {
  task: TaskItemResponse;
  x: number;
  y: number;
}

function findCycleNodes(edges: Map<string, string[]>): Set<string> {
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
    for (const next of edges.get(id) ?? []) {
      visit(next, [...stack, id]);
    }
    state.set(id, 2);
  }

  for (const id of edges.keys()) visit(id, []);
  return cyclic;
}

interface GraphModalProps {
  tasks: TaskItemResponse[];
  workspaceId: string;
  projectId: string;
  onSelectTask: (taskId: string) => void;
  onClose: () => void;
}

export function GraphModal({
  tasks,
  workspaceId,
  projectId,
  onSelectTask,
  onClose,
}: GraphModalProps) {
  const [edges, setEdges] = useState<Map<string, string[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const scoped = tasks.slice(0, 25);

    Promise.allSettled(
      scoped.map((task) =>
        getTaskDependencies(workspaceId, projectId, task.id).then(
          (deps: TaskDependencyResponse[]) => [task.id, deps] as const,
        ),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<string, string[]>();
      const known = new Set(scoped.map((t) => t.id));
      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const [taskId, deps] = result.value;
        map.set(
          taskId,
          deps
            .map((d) => d.blockerTaskId)
            .filter((id) => known.has(id)),
        );
      }
      setEdges(map);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [tasks, workspaceId, projectId]);

  const layout = useMemo(() => {
    if (!edges) return null;

    const byStatus = new Map<TaskItemResponse["status"], TaskItemResponse[]>();
    for (const status of COLUMNS.map((c) => c.status)) byStatus.set(status, []);
    for (const task of tasks.slice(0, 25)) byStatus.get(task.status)?.push(task);

    const nodes = new Map<string, PositionedNode>();
    let maxRows = 1;
    COLUMNS.forEach((column, columnIndex) => {
      const list = byStatus.get(column.status) ?? [];
      maxRows = Math.max(maxRows, list.length);
      list.forEach((task, rowIndex) => {
        nodes.set(task.id, {
          task,
          x: PAD + columnIndex * COL_GAP,
          y: PAD + rowIndex * (NODE_H + ROW_GAP),
        });
      });
    });

    const width = PAD * 2 + (COLUMNS.length - 1) * COL_GAP + NODE_W;
    const height = PAD * 2 + maxRows * (NODE_H + ROW_GAP);

    const edgeList: { from: PositionedNode; to: PositionedNode; cyclic: boolean }[] = [];
    const cyclic = findCycleNodes(edges);
    for (const [blockedId, blockers] of edges) {
      const to = nodes.get(blockedId);
      if (!to) continue;
      for (const blockerId of blockers) {
        const from = nodes.get(blockerId);
        if (!from) continue;
        edgeList.push({ from, to, cyclic: cyclic.has(blockedId) && cyclic.has(blockerId) });
      }
    }

    return { nodes: [...nodes.values()], edgeList, width, height, cyclic };
  }, [edges, tasks]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="Dependency graph">
      <button
        type="button"
        aria-label="Close graph"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-foreground/30"
      />
      <div className="absolute left-1/2 top-1/2 flex max-h-[86vh] w-[min(92vw,880px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <header className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-display text-base font-semibold">Dependency graph</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {loading || !layout ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Loading dependencies…
            </p>
          ) : layout.nodes.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No tasks to graph yet.
            </p>
          ) : (
            <svg
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="w-full"
              role="img"
              aria-label="Task dependency graph"
            >
              <g>
                {COLUMNS.map((column, i) => (
                  <text
                    key={column.status}
                    x={PAD + i * COL_GAP + NODE_W / 2}
                    y={PAD - 6}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    fill="var(--color-muted-foreground)"
                  >
                    {column.label.toUpperCase()}
                  </text>
                ))}
              </g>

              {layout.edgeList.map((edge, i) => (
                <line
                  key={i}
                  x1={edge.from.x + NODE_W}
                  y1={edge.from.y + NODE_H / 2}
                  x2={edge.to.x}
                  y2={edge.to.y + NODE_H / 2}
                  stroke={
                    edge.cyclic ? "var(--color-destructive)" : "var(--color-border-strong)"
                  }
                  strokeWidth="1.5"
                >
                  <title>blocks</title>
                </line>
              ))}

              {layout.nodes.map(({ task, x, y }) => {
                const isCyclic = layout.cyclic.has(task.id);
                return (
                  <g
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() => {
                      onSelectTask(task.id);
                      onClose();
                    }}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={NODE_W}
                      height={NODE_H}
                      rx="8"
                      fill="var(--color-card)"
                      stroke={
                        isCyclic ? "var(--color-destructive)" : "var(--color-border)"
                      }
                      strokeWidth={isCyclic ? 2 : 1}
                    />
                    <title>{`${task.title}${isCyclic ? " — ⚠ circular dependency" : ""}`}</title>
                    <text
                      x={x + NODE_W / 2}
                      y={y + NODE_H / 2 + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="var(--color-foreground)"
                    >
                      {task.title.length > 18
                        ? `${task.title.slice(0, 17)}…`
                        : task.title}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <footer className="flex items-center gap-4 border-t border-border px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
          <span>line = blocks</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border-2 border-destructive" aria-hidden />
            circular dependency
          </span>
          <span className="ml-auto">first 25 tasks · click a card to open</span>
        </footer>
      </div>
    </div>
  );
}
