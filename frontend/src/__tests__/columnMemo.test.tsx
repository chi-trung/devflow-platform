import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Column sits directly under BoardPage, the most re-render-heavy surface in
// the app: every keystroke in the filter input, every drag and every SignalR
// project-event reload re-renders the parent. Seven columns mount at once, and
// each one re-slices its window and re-partitions its swimlanes in the body.
//
// This test mounts one Column and drives a no-op parent re-render: the memo
// must hold (the body must not re-run), while a real prop change must still
// re-render. A memo that never re-renders at all would be an over-hold bug.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => {
    if (opts && typeof opts === "object" && "count" in opts) return `+${opts.count}`;
    return k;
  } }),
}));

// TaskCard (rendered by Column) calls useToast; the provider is irrelevant to
// the render-count measurement, so the hook is stubbed.
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => undefined }),
}));

import { Column, __columnRenders, __resetColumnRenders } from "../components/board/Column";
import type { TaskItemResponse } from "../types/api";

// jsdom has no IntersectionObserver; Column only uses it to grow the window
// when the sentinel scrolls into view, which these tests never trigger.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);


const STATUS = "Ready" as const;

function makeTask(id: string, status: TaskItemResponse["status"]): TaskItemResponse {
  return {
    id,
    projectId: "p1",
    key: `DF-1${id.slice(1)}`,
    number: 1,
    title: `Task ${id}`,
    description: null,
    status,
    priority: "Medium",
    assigneeId: null,
    sprintId: null,
    epicId: null,
    parentTaskId: null,
    dueDateUtc: null,
    completedAtUtc: null,
    position: 0,
  };
}

// Above WINDOW_CHUNK (12). At or below it, the shrink-window effect fires on
// mount (12 -> tasks.length) and itself causes a second render, which would
// drown the no-op signal being measured.
const TASKS: TaskItemResponse[] = Array.from({ length: 14 }, (_, i) =>
  makeTask(`t${i}`, STATUS),
);

function props(overrides: Partial<React.ComponentProps<typeof Column>> = {}) {
  return {
    title: "Ready",
    status: STATUS,
    tasks: TASKS,
    members: [],
    onDropTask: () => undefined,
    onDelete: () => undefined,
    onSelect: () => undefined,
    workspaceId: "ws",
    projectId: "p1",
    ...overrides,
  };
}

describe("Column is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetColumnRenders();
  });

  it("renders once on mount", () => {
    render(<Column {...props()} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
    // Two of the fourteen tasks are behind the window, so the "show more"
    // control is present and the visible slice is exactly twelve cards.
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(__columnRenders(), "Column should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const p = props();
    const { rerender } = render(<Column {...p} />);
    expect(__columnRenders()).toBe(1);

    // Same props by identity: this is what BoardPage's keystroke re-render
    // looks like when the handlers are stable. The memo must hold.
    rerender(<Column {...p} />);
    expect(__columnRenders(), "Column body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when a task is added (the memo does not over-hold)", () => {
    const onDropTask = () => undefined;
    const onDelete = () => undefined;
    const onSelect = () => undefined;

    const { rerender } = render(
      <Column {...props({ onDropTask, onDelete, onSelect })} />,
    );
    expect(__columnRenders()).toBe(1);

    const grown = [...TASKS, makeTask("t14", STATUS)];
    rerender(
      <Column
        {...props({
          tasks: grown,
          onDropTask,
          onDelete,
          onSelect,
        })}
      />,
    );
    // Fifteen tasks, window still twelve, so t14 stays behind the window and
    // only the header count moves -- but the body must still re-run.
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(__columnRenders(), "a new tasks array must re-render").toBe(2);
  });

  it("re-renders when a handler identity changes", () => {
    const { rerender } = render(<Column {...props()} />);
    expect(__columnRenders()).toBe(1);

    // An unstable handler at the render site is exactly the defect the memo
    // guards against; a new identity must release it.
    rerender(<Column {...props({ onDropTask: () => undefined })} />);
    expect(__columnRenders(), "a new handler identity must re-render").toBe(2);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("swimlane-mode change still re-renders and partitions", () => {
    const onDropTask = () => undefined;
    const onDelete = () => undefined;
    const onSelect = () => undefined;

    const { rerender } = render(
      <Column {...props({ onDropTask, onDelete, onSelect })} />,
    );
    expect(__columnRenders()).toBe(1);

    // Toggling swimlane mode is the most expensive body path: the partition
    // and the label sort both run. It must still run when the prop changes.
    rerender(
      <Column
        {...props({
          swimlaneMode: "assignee",
          onDropTask,
          onDelete,
          onSelect,
        })}
      />,
    );
    expect(__columnRenders(), "swimlaneMode change must re-render").toBe(2);
    expect(screen.getByText("board.swimlaneUnassigned")).toBeInTheDocument();
  });

  it("drops still fire through the memoised handler", () => {
    const calls: Array<[string, string, string | null]> = [];
    const onDropTask = (
      taskId: string,
      status: TaskItemResponse["status"],
      before?: string | null,
    ) => calls.push([taskId, status, before ?? null]);

    render(<Column {...props({ onDropTask })} />);

    // jsdom has no DataTransfer, so the one field the handler reads is faked.
    const section = screen.getByLabelText("Ready");
    fireEvent.drop(section, {
      dataTransfer: { getData: (kind: string) => (kind === "text/plain" ? "t2" : "") } as never,
    });

    // No card sits above the drop point, so the insertion index resolves to
    // the end and beforeTaskId stays null.
    expect(calls, "the drop handler must be wired through the memo").toEqual([
      ["t2", "Ready", null],
    ]);
  });

  it("does not re-render when a sibling column's tasks change", () => {
    // BoardPage hands every column a stable tasks array from tasksByStatus.
    // The paired guard for that lives in boardVisibleTasksMemo.test.ts; here
    // the contract is that a same-identity rerender costs the body nothing
    // even after the windowing effect has already settled.
    const p = props();
    const { rerender } = render(<Column {...p} />);
    expect(__columnRenders()).toBe(1);

    act(() => {
      __resetColumnRenders();
    });
    rerender(<Column {...p} />);
    expect(__columnRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
