import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// SprintPlanningPage re-renders on every keystroke in the sprint start/end-date
// inputs, and SprintBoard's body is quadratic in the inputs: a full
// tasks.filter() per sprint column plus one for the backlog, and dragHandlers()
// re-created for every section on each of those renders.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Interpolate whichever option key the call site uses: sprintColumnAria
    // passes { name }, boardTaskAria passes { title }.
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        const v = opts.name ?? opts.title ?? opts.value;
        if (v !== undefined) return `${k}:${String(v)}`;
      }
      return k;
    },
  }),
}));

import { SprintBoard, __sprintBoardRenders, __resetSprintBoardRenders } from "../components/sprint/SprintBoard";
import type { SprintResponse, TaskItemResponse } from "../types/api";

const SPRINTS: SprintResponse[] = [
  { id: "s1", name: "Sprint 1", goal: null, status: "Active", startDateUtc: null, endDateUtc: null, completedAtUtc: null, projectId: "p1" },
  { id: "s2", name: "Sprint 2", goal: null, status: "Planned", startDateUtc: null, endDateUtc: null, completedAtUtc: null, projectId: "p1" },
  { id: "s3", name: "Old", goal: null, status: "Completed", startDateUtc: null, endDateUtc: null, completedAtUtc: null, projectId: "p1" },
];

function task(id: string, sprintId: string | null, status: TaskItemResponse["status"] = "Ready"): TaskItemResponse {
  return {
    id,
    title: `Task ${id}`,
    status,
    priority: "Medium",
    sprintId,
    projectId: "p1",
  } as TaskItemResponse;
}

// jsdom has no DataTransfer; the handlers only read getData("text/plain").
function fakeTransfer(payload: string): unknown {
  return { getData: (kind: string) => (kind === "text/plain" ? payload : "") };
}

function props(overrides: Partial<React.ComponentProps<typeof SprintBoard>> = {}) {
  return {
    tasks: [
      task("t1", "s1"),
      task("t2", "s1", "Done"),
      task("t3", null),
    ],
    sprints: SPRINTS,
    onAssign: () => undefined,
    onRemove: () => undefined,
    ...overrides,
  };
}

describe("SprintBoard is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetSprintBoardRenders();
  });

  it("renders once on mount and groups tasks by sprint", () => {
    render(<SprintBoard {...props()} />);
    expect(screen.getByText("Task t1")).toBeInTheDocument();
    expect(screen.getByText("Task t3")).toBeInTheDocument();
    expect(__sprintBoardRenders(), "SprintBoard should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const p = props();
    const { rerender } = render(<SprintBoard {...p} />);
    expect(__sprintBoardRenders()).toBe(1);

    // Same props by identity: this is what the page's keystroke re-render looks
    // like when tasks/sprints/onAssign/onRemove are all stable.
    rerender(<SprintBoard {...p} />);
    expect(__sprintBoardRenders(), "SprintBoard body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the tasks array changes (the memo does not over-hold)", () => {
    const onAssign = () => undefined;
    const { rerender } = render(<SprintBoard {...props({ onAssign })} />);
    expect(__sprintBoardRenders()).toBe(1);

    rerender(<SprintBoard {...props({ tasks: [...props().tasks, task("t4", null)], onAssign })} />);
    expect(__sprintBoardRenders(), "a new tasks array must re-render").toBe(2);
    expect(screen.getByText("Task t4")).toBeInTheDocument();
  });

  it("re-renders when the sprints array identity changes", () => {
    const onAssign = () => undefined;
    const { rerender } = render(<SprintBoard {...props({ onAssign })} />);
    expect(__sprintBoardRenders()).toBe(1);

    rerender(<SprintBoard {...props({ sprints: [...SPRINTS], onAssign })} />);
    expect(__sprintBoardRenders(), "a new sprints array must re-render").toBe(2);
  });

  it("dispatches assign through the memoised handler on a drop", () => {
    const assign: string[][] = [];
    render(
      <SprintBoard
        {...props({
          onAssign: (taskId, sprintId) => { void assign.push([taskId, sprintId]); },
        })}
      />,
    );

    // The planned column takes t3 out of the backlog. The column's drag
    // handlers must still be wired through the memo.
    const column = screen.getByLabelText("sprint.sprintColumnAria:Sprint 2");
    fireEvent.drop(column, { dataTransfer: fakeTransfer("t3") as never });
    expect(assign).toEqual([["t3", "s2"]]);
  });

  it("dispatches remove when a sprinted task is dropped on the backlog", () => {
    const remove: string[][] = [];
    render(
      <SprintBoard
        {...props({
          onRemove: (taskId, sprintId) => { void remove.push([taskId, sprintId]); },
        })}
      />,
    );

    const backlog = screen.getByLabelText("sprint.backlogColumnAria");
    fireEvent.drop(backlog, { dataTransfer: fakeTransfer("t1") as never });
    expect(remove).toEqual([["t1", "s1"]]);
  });

  it("does not assign when dropping on a completed sprint", () => {
    const assign: string[][] = [];
    render(
      <SprintBoard
        {...props({
          onAssign: (taskId, sprintId) => { void assign.push([taskId, sprintId]); },
        })}
      />,
    );

    // Completed columns do not spread drag handlers at all.
    const column = screen.getByLabelText("sprint.sprintColumnAria:Old");
    fireEvent.drop(column, { dataTransfer: fakeTransfer("t3") as never });
    expect(assign).toEqual([]);
  });

  it("does not re-run the body when a sibling re-renders after settling", () => {
    const p = props();
    const { rerender } = render(<SprintBoard {...p} />);
    expect(__sprintBoardRenders()).toBe(1);

    __resetSprintBoardRenders();
    rerender(<SprintBoard {...p} />);
    expect(__sprintBoardRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
