import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// TaskCard is rendered once per visible task (up to TASKS_PER_PAGE = 24).
// BoardPage re-renders on every keystroke — a selection toggle changes
// `selected` for ONE card. Before the memo, every card received a fresh
// handler identity from the parent and re-ran its body each time: a
// members.find() scan, three Date constructions, a markdown split + regex
// filter over the definition of done, and a locale format — for all 24
// cards, on every keystroke.
//
// This locks the invariant the memo exists to make: when the parent rerenders
// and only one card's prop changed, only that card re-renders.
//
// Counting note: the counter has to be inside the memoised component. An
// un-memoised wrapper re-runs for every card regardless, a memoised wrapper
// blocks the re-render being measured, and React's Profiler counts the parent
// commit too — none of them separate card-level renders. The counter is
// exported test-only from TaskCard for exactly this reason.

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: vi.fn() }),
}));

import {
  TaskCard,
  __taskCardRenders,
  __resetTaskCardRenders,
} from "../components/board/TaskCard";
import type { TaskItemResponse, WorkspaceMemberResponse } from "../types/api";

function task(id: string): TaskItemResponse {
  return {
    id,
    key: "DEV-1",
    title: `Task ${id}`,
    description: null,
    status: "InProgress",
    priority: "Medium",
    assigneeId: "u1",
    storyPoints: 3,
    dueDateUtc: "2026-09-18T00:00:00Z",
    definitionOfDone: "- [x] one\n- [ ] two",
    enteredReviewAtUtc: null,
    prSummary: null,
    createdAtUtc: "2026-01-01T00:00:00Z",
    updatedAtUtc: "2026-01-01T00:00:00Z",
  } as unknown as TaskItemResponse;
}

const members: WorkspaceMemberResponse[] = [
  { userId: "u1", displayName: "Ada", username: "ada", role: "Member" },
] as unknown as WorkspaceMemberResponse[];

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

// BoardPage declares these once with useCallback, so they hold identity
// across renders. A fresh vi.fn() per render would defeat the memo and make
// this test measure the harness instead of the page.
const onDelete = vi.fn();
const onSelect = vi.fn();
const onToggleSelect = vi.fn();

// Task objects must be stable too: BoardPage's tasks come from useApi state,
// so a task keeps its identity across renders. Building them inside the card
// would hand the memo a fresh object every render.
const TASKS: Record<string, TaskItemResponse> = Object.fromEntries(
  IDS.map((id) => [id, task(id)]),
);

function Cards({ selectedIds }: { selectedIds: Set<string> }) {
  return (
    <div>
      {IDS.map((id) => (
        <TaskCard
          key={id}
          task={TASKS[id]}
          members={members}
          isBlocked={false}
          onDelete={onDelete}
          onSelect={onSelect}
          onToggleSelect={onToggleSelect}
          selectionMode
          selected={selectedIds.has(id)}
          workspaceId="ws"
          projectId="pr"
        />
      ))}
    </div>
  );
}

describe("TaskCard memo", () => {
  it("re-renders only the card whose prop actually changed", () => {
    __resetTaskCardRenders();
    const { rerender } = render(<Cards selectedIds={new Set()} />);
    // useAttachmentPreviews fires setUrls({}) on mount when a task has no
    // attachment previews, so each card renders twice at mount. That is
    // one-off mount overhead, not the per-keystroke cost the memo targets.
    expect(__taskCardRenders(), "mount renders each card, plus its previews settle").toBe(IDS.length * 2);
    __resetTaskCardRenders();

    // A no-op rerender: nothing about any card changed, so the memo holds for
    // all eight. Before the memo this re-ran every visible card (24 per board
    // page) on every keystroke.
    rerender(<Cards selectedIds={new Set()} />);
    expect(
      __taskCardRenders(),
      "a rerender that changes no card must render no cards",
    ).toBe(0);

    // Flip ONE card's selection: only that card may re-render. Before the
    // memo this was 24, which is the whole reason the memo exists.
    rerender(<Cards selectedIds={new Set(["a"])} />);
    expect(
      __taskCardRenders(),
      "only the card whose `selected` changed may re-render",
    ).toBe(1);

    expect(screen.getAllByText(/Task [a-h]/)).toHaveLength(IDS.length);
  });
});
