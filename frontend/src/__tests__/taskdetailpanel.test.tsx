import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { TaskDetailPanel } from "../components/board/TaskDetailPanel";
import type { TaskItemResponse } from "../types/api";

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

// jsdom has no layout engine, so offsetParent is always null and the trap's
// visibility filter would drop every control. A parent-chain stub marks
// everything visible; the trap and the test compute the same list, so the
// wrap assertions below still exercise the real boundary logic.
Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return this.parentElement;
  },
});

const task = {
  id: "t1",
  projectId: "p1",
  key: "PB-1",
  number: 1,
  title: "Probe task 1",
  description: null,
  status: "Idea",
  priority: "Medium",
  assigneeId: null,
  sprintId: null,
  epicId: null,
  parentTaskId: null,
  dueDateUtc: null,
  completedAtUtc: null,
} as TaskItemResponse;

function renderPanel() {
  return render(
    <TaskDetailPanel
      task={task}
      currentUser={null}
      members={[]}
      sprints={[]}
      allTasks={[]}
      workspaceId="w1"
      projectId="p1"
      onClose={() => {}}
      onTaskChanged={() => {}}
    />,
  );
}

const CONTROL_SELECTOR =
  'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';

function tabbables(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && el.offsetParent !== null,
  );
}

describe("TaskDetailPanel focus trap", () => {
  it("is announced as a modal dialog and moves focus inside on open", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    // The backdrop close button is tabIndex -1; initial focus must land on
    // the first control a real Tab press could reach.
    const active = document.activeElement as HTMLElement;
    expect(active.tabIndex).toBeGreaterThanOrEqual(0);
    expect(active).toBe(tabbables(dialog)[0]);
  });

  it("wraps Tab from the last control to the first, and Shift+Tab back", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog");
    const items = tabbables(dialog);
    expect(items.length).toBeGreaterThan(3);
    items[items.length - 1].focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("pulls focus back into the dialog when it has leaked behind the overlay", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    expect(dialog.contains(document.activeElement)).toBe(false);
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    outside.remove();
  });
});
