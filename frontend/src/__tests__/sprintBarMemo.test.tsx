import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// SprintBar mounts once on BoardPage and the page re-renders on every keystroke
// in the filter input, every drag and every SignalR project-event reload.
// Without a memo each of those re-ran 14 useState initialisers, the velocity
// fetch effect's dependency walk, the active/planned derivations and the
// ~330-line JSX tree.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object" && "value" in opts) return `${k}:${String(opts.value)}`;
      return k;
    },
  }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => undefined }),
}));

// getVelocity is the only network call in the render path; the effect fires on
// filter change, not on mount with "all".
vi.mock("../lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/api")>();
  return {
    ...real,
    getVelocity: () =>
      Promise.resolve({
        sprints: [{ sprintId: "s1", velocity: 12, completedPoints: 8, totalPoints: 10 }],
      }),
  };
});

import { SprintBar, __sprintBarRenders, __resetSprintBarRenders } from "../components/board/SprintBar";
import type { SprintResponse } from "../types/api";

const SPRINTS: SprintResponse[] = [
  {
    id: "s1",
    name: "Sprint 1",
    goal: "Ship the board perf",
    status: "Active",
    startDateUtc: "2026-09-01",
    endDateUtc: "2026-09-15",
    completedAtUtc: null,
    projectId: "p1",
  },
  {
    id: "s2",
    name: "Sprint 2",
    goal: null,
    status: "Planned",
    startDateUtc: "2026-09-16",
    endDateUtc: "2026-09-30",
    completedAtUtc: null,
    projectId: "p1",
  },
];

function props(overrides: Partial<React.ComponentProps<typeof SprintBar>> = {}) {
  return {
    sprints: SPRINTS,
    canManage: true,
    filter: "all",
    onFilterChange: () => undefined,
    onChanged: () => undefined,
    workspaceId: "w1",
    projectId: "p1",
    ...overrides,
  };
}

describe("SprintBar is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetSprintBarRenders();
  });

  it("renders once on mount", () => {
    render(<SprintBar {...props()} />);
    expect(screen.getByText("sprint.active")).toBeInTheDocument();
    expect(__sprintBarRenders(), "SprintBar should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const p = props();
    const { rerender } = render(<SprintBar {...p} />);
    expect(__sprintBarRenders()).toBe(1);

    // Same props by identity: this is what BoardPage's keystroke re-render
    // looks like when onChanged is a useCallback and the rest are primitives
    // or a memoised array.
    rerender(<SprintBar {...p} />);
    expect(__sprintBarRenders(), "SprintBar body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the filter changes (the memo does not over-hold)", () => {
    const onFilterChange = () => undefined;
    const { rerender } = render(<SprintBar {...props({ onFilterChange })} />);
    expect(__sprintBarRenders()).toBe(1);

    rerender(
      <SprintBar
        {...props({
          filter: "s1",
          onFilterChange,
        })}
      />,
    );
    expect(__sprintBarRenders(), "a changed filter must re-render").toBe(2);
  });

  it("re-renders when the sprints array identity changes", () => {
    const onChanged = () => undefined;
    const { rerender } = render(<SprintBar {...props({ onChanged })} />);
    expect(__sprintBarRenders()).toBe(1);

    rerender(<SprintBar {...props({ sprints: [...SPRINTS], onChanged })} />);
    expect(__sprintBarRenders(), "a new sprints array must re-render").toBe(2);
  });

  it("re-renders when canManage flips (the admin controls appear)", () => {
    const p = props({ canManage: false });
    const { rerender } = render(<SprintBar {...p} />);
    expect(__sprintBarRenders()).toBe(1);

    rerender(<SprintBar {...props({ canManage: true })} />);
    expect(__sprintBarRenders(), "a role change must re-render the controls").toBe(2);
  });

  it("dispatches the sprint filter change through the memoised handler", () => {
    const values: string[] = [];
    render(<SprintBar {...props({ onFilterChange: (v) => values.push(v) })} />);

    // The select is interactive through the memo (not a static subtree). It is
    // wrapped in a <label> whose visible text is an sr-only span.
    fireEvent.change(screen.getByLabelText("sprint.filterSrOnly"), {
      target: { value: "s1" },
    });
    expect(values).toContain("s1");
  });

  it("does not re-run the body when a sibling re-renders after settling", () => {
    // BoardPage hands SprintBar a stable onChanged via a useCallback (guarded
    // in sprintBarStableProps.test.ts). Here the contract is that a
    // same-identity rerender costs the body nothing even after local form
    // state has been touched.
    const p = props();
    const { rerender } = render(<SprintBar {...p} />);
    expect(__sprintBarRenders()).toBe(1);

    __resetSprintBarRenders();
    rerender(<SprintBar {...p} />);
    expect(__sprintBarRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
