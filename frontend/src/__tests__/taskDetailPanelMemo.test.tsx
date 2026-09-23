import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// TEMP-PROBE: measures whether TaskDetailPanel re-renders when the parent
// re-renders without changing anything the panel reads. BoardPage re-renders
// on every keystroke while the panel is open as a modal overlay. Deleted once
// the measurement is recorded.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => {} }),
}));

vi.mock("../lib/api", () => ({
  api: vi.fn(async () => []),
  createTemplate: vi.fn(async () => ({})),
  tokens: { access: "t", refresh: "r" },
  isWatchingTask: vi.fn(async () => false),
  watchTask: vi.fn(async () => ({})),
  unwatchTask: vi.fn(async () => ({})),
  uploadTaskAttachment: vi.fn(async () => ({})),
  getTaskWatchers: vi.fn(async () => []),
  listRecurringRules: vi.fn(async () => []),
  createRecurringRule: vi.fn(async () => ({})),
  updateRecurringRule: vi.fn(async () => ({})),
  deleteRecurringRule: vi.fn(async () => undefined),
  pagedItems: (response: unknown) =>
    Array.isArray(response) ? response : [],
  addTaskDependency: vi.fn(async () => ({})),
  getTaskDependencies: vi.fn(async () => []),
  removeTaskDependency: vi.fn(async () => ({})),
  deleteTimeEntry: vi.fn(async () => ({})),
  getTimeEntries: vi.fn(async () => []),
  logTimeEntry: vi.fn(async () => ({})),
  setTaskEstimation: vi.fn(async () => ({})),
  getTaskFieldValues: vi.fn(async () => []),
  getAttachmentObjectUrl: vi.fn(async () => ""),
  planAiTask: vi.fn(async () => ({})),
  applyAiPlan: vi.fn(async () => ({})),
  getLatestAiPlan: vi.fn(async () => null),
  createTaskPullRequest: vi.fn(async () => ({})),
  getGitHubIntegration: vi.fn(async () => null),
  getProjectPRs: vi.fn(async () => []),
}));

Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return this.parentElement;
  },
});

import {
  TaskDetailPanel,
  __detailPanelRenders,
  __resetDetailPanelRenders,
} from "../components/board/TaskDetailPanel";
import type { TaskItemResponse, WorkspaceMemberResponse } from "../types/api";

const task: TaskItemResponse = {
  id: "t1",
  projectId: "p1",
  key: "PB-1",
  title: "Probe task",
  description: null,
  status: "Idea",
  priority: "Medium",
  assigneeId: null,
  storyPoints: 3,
  dueDateUtc: null,
  definitionOfDone: null,
  enteredReviewAtUtc: null,
  prSummary: null,
  createdAtUtc: "2026-01-01T00:00:00Z",
  updatedAtUtc: "2026-01-01T00:00:00Z",
} as unknown as TaskItemResponse;

const members: WorkspaceMemberResponse[] = [];

// Stable identities, as BoardPage supplies them when the memo matters.
const SPRINTS = [{ id: "s1", name: "Sprint 1", status: "Active" }] as never;
const ALL_TASKS = [task] as TaskItemResponse[];

describe("TaskDetailPanel render probe", () => {
  it("does not re-render when the parent re-renders without changes", () => {
    __resetDetailPanelRenders();
    const props = {
      task,
      currentUser: null,
      members,
      sprints: SPRINTS,
      allTasks: ALL_TASKS,
      workspaceId: "ws",
      projectId: "p1",
      onClose: vi.fn(),
      onTaskChanged: vi.fn(),
    };

    const { rerender } = render(<TaskDetailPanel {...props} />);
    const atMount = __detailPanelRenders();
    expect(atMount).toBeGreaterThanOrEqual(1);

    __resetDetailPanelRenders();
    // Byte-identical props: nothing the panel reads changed.
    rerender(<TaskDetailPanel {...props} />);
    const afterNoop = __detailPanelRenders();
    expect(afterNoop, "no-op rerender must not re-render the panel").toBe(0);

    // The memo must not over-hold: a real task change has to re-render, or
    // the panel would show a stale title/status while the board moved on.
    __resetDetailPanelRenders();
    const moved = { ...task, status: "Done" } as TaskItemResponse;
    rerender(<TaskDetailPanel {...props} task={moved} />);
    expect(
      __detailPanelRenders(),
      "a changed task prop must still re-render the panel",
    ).toBeGreaterThanOrEqual(1);
  });
});
