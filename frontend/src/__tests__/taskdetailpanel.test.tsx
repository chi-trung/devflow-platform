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

describe("TaskDetailPanel page chrome", () => {
  it("is not a modal dialog (full-page article)", () => {
    renderPanel();
    expect(screen.queryByRole("dialog")).toBeNull();
    // No fixed overlay root either — page flow only.
    const article = document.querySelector("article");
    expect(article).not.toBeNull();
    expect(article?.className).not.toMatch(/fixed/);
  });

  it("exposes an h1 with a sr-only title for the AppShell document.title mirror", () => {
    renderPanel();
    const h1 = screen.getByRole("heading", { level: 1 });
    // Input values do not land in textContent; the sr-only span is what the
    // MutationObserver mirror reads. Dropping it freezes the tab title.
    expect(h1.querySelector(".sr-only")?.textContent).toBe("Probe task 1");
  });

  it("starts description in read mode and toggles to a textarea on Edit", () => {
    renderPanel();
    // Empty description shows the muted addDetail placeholder, not a form.
    expect(screen.queryByLabelText("task.description")).toBeNull();
    expect(screen.getByText("task.addDetail")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const textarea = screen.getByLabelText("task.description");
    expect(textarea.tagName).toBe("TEXTAREA");
    // Editing must surface a dirty Save so the draft is not a trap.
    // (Description alone is dirty only after a change; type first.)
    fireEvent.change(textarea, { target: { value: "Now with body" } });
    expect(
      screen.getByRole("button", { name: "task.saveChanges" }),
    ).toBeTruthy();
  });

  it("leaves edit mode via Close and restores the read view", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    expect(screen.getByLabelText("task.description")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));
    expect(screen.queryByLabelText("task.description")).toBeNull();
    expect(screen.getByRole("button", { name: "common.edit" })).toBeTruthy();
  });

  it("does not autofocus-trap: Tab is free to leave the article", () => {
    // The old modal used useFocusTrap; a page must not steal Tab. Mount and
    // assert no dialog aria + focus can sit outside without being yanked.
    const { container } = renderPanel();
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();
    fireEvent.keyDown(container, { key: "Tab" });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
