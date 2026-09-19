import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// FilterBar mounts once on BoardPage, the most re-render-heavy surface in the
// app: every keystroke in its own search input, every drag, and every SignalR
// project-event reload re-renders the parent. Without a memo each of those
// re-ran the chip build (up to seven t() calls plus two .find() lookups), the
// members/labels option lists, and the ~220-line JSX tree.

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

// localStorage-backed preset store; keep each test's writes isolated.
vi.mock("../lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/api")>();
  const store = new Map<string, string>();
  return {
    ...real,
    loadFilterPresets: (projectId: string) => {
      const raw = store.get(projectId);
      return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    },
    saveFilterPreset: (projectId: string, name: string, state: unknown) => {
      const raw = store.get(projectId);
      const all = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      all[name] = state;
      store.set(projectId, JSON.stringify(all));
      return true;
    },
    deleteFilterPreset: (projectId: string, name: string) => {
      const raw = store.get(projectId);
      if (!raw) return false;
      const all = JSON.parse(raw) as Record<string, unknown>;
      delete all[name];
      store.set(projectId, JSON.stringify(all));
      return true;
    },
  };
});

import { FilterBar, __filterBarRenders, __resetFilterBarRenders } from "../components/board/FilterBar";
import type { BoardFilterState } from "../lib/api";
import type { LabelResponse, WorkspaceMemberResponse } from "../types/api";

const MEMBERS: WorkspaceMemberResponse[] = [
  { userId: "u1", email: "alice@x.test", username: "alice", displayName: "Alice", role: "Member" },
  { userId: "u2", email: "bob@x.test", username: "bob", displayName: "", role: "Member" },
];
const LABELS: LabelResponse[] = [
  { id: "l1", name: "bug", color: "#f00", projectId: "p1" },
  { id: "l2", name: "docs", color: "#0f0", projectId: "p1" },
];

const BASE_FILTER: BoardFilterState = {
  sprint: "all",
  search: "",
  priority: "",
  assignee: "",
  label: "",
  pr: "",
  dueFrom: "",
  dueTo: "",
  blockedOnly: false,
};

function props(overrides: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
  return {
    projectId: "p1",
    members: MEMBERS,
    labels: LABELS,
    current: BASE_FILTER,
    onChange: () => undefined,
    ...overrides,
  };
}

describe("FilterBar is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetFilterBarRenders();
  });

  it("renders once on mount", () => {
    render(<FilterBar {...props()} />);
    expect(screen.getByText("filter.filters")).toBeInTheDocument();
    expect(__filterBarRenders(), "FilterBar should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const p = props();
    const { rerender } = render(<FilterBar {...p} />);
    expect(__filterBarRenders()).toBe(1);

    // Same props by identity: this is what BoardPage's keystroke re-render
    // looks like when current/onChange/members/labels are all stable.
    rerender(<FilterBar {...p} />);
    expect(__filterBarRenders(), "FilterBar body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the filter state changes (the memo does not over-hold)", () => {
    const onChange = () => undefined;
    const { rerender } = render(<FilterBar {...props({ onChange })} />);
    expect(__filterBarRenders()).toBe(1);

    rerender(
      <FilterBar
        {...props({
          current: { ...BASE_FILTER, search: "abc" },
          onChange,
        })}
      />,
    );
    expect(__filterBarRenders(), "a changed filter state must re-render").toBe(2);
  });

  it("re-renders when members or labels identity changes", () => {
    const onChange = () => undefined;
    const { rerender } = render(<FilterBar {...props({ onChange })} />);
    expect(__filterBarRenders()).toBe(1);

    rerender(
      <FilterBar
        {...props({
          members: [...MEMBERS],
          onChange,
        })}
      />,
    );
    expect(__filterBarRenders(), "a new members array must re-render").toBe(2);

    rerender(
      <FilterBar
        {...props({
          members: [...MEMBERS],
          labels: [...LABELS],
          onChange,
        })}
      />,
    );
    expect(__filterBarRenders(), "a new labels array must re-render").toBe(3);
  });

  it("dispatches filter changes through the memoised handler", () => {
    const patches: Partial<BoardFilterState>[] = [];
    render(<FilterBar {...props({ onChange: (patch) => patches.push(patch) })} />);

    // The priority select exercises the normalisation at the call site
    // ("" -> null) — but at this level the raw value is what is dispatched.
    fireEvent.change(screen.getByLabelText("filter.filterByPriority"), {
      target: { value: "High" },
    });
    expect(patches).toContainEqual({ priority: "High" });

    fireEvent.change(screen.getByLabelText("filter.filterByAssignee"), {
      target: { value: "u2" },
    });
    expect(patches).toContainEqual({ assignee: "u2" });

    // The blocked-only button toggles, so the body must be interactive
    // through the memo (it is not a static subtree).
    fireEvent.click(screen.getByText("filter.blocked"));
    expect(patches).toContainEqual({ blockedOnly: true });
  });

  it("clears a filter via a chip click", () => {
    const patches: Partial<BoardFilterState>[] = [];
    render(
      <FilterBar
        {...props({
          current: { ...BASE_FILTER, label: "l1" },
          onChange: (patch) => patches.push(patch),
        })}
      />,
    );
    // l1 resolves to the "bug" label, so the chip reads the derived name.
    const chip = screen.getByText("filter.chipLabel:bug");
    fireEvent.click(chip);
    expect(patches).toContainEqual({ label: "" });
  });

  it("does not re-run the body when a sibling re-renders", () => {
    // BoardPage hands FilterBar stable identities for current/onChange via a
    // useMemo/useCallback pair (guarded in filterBarStableProps.test.ts).
    // Here the contract is that a same-identity rerender costs the body
    // nothing even after local preset state has settled.
    const p = props();
    const { rerender } = render(<FilterBar {...p} />);
    expect(__filterBarRenders()).toBe(1);
    expect(screen.getByText("filter.filters")).toBeInTheDocument();

    __resetFilterBarRenders();
    rerender(<FilterBar {...p} />);
    expect(__filterBarRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
