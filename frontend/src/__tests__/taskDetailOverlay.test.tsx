import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { TaskItemResponse } from "../types/api";

// Fail-closed + modal chrome contract for the in-page detail overlay:
//  - loading && data===null  → skeleton (no empty article)
//  - error !== null && data === null → ErrorAlert + Retry, never []/empty
//  - success → panel with h1 + dialog role + focus trap wrapper
//  - Escape (outside fields) closes; stopPropagation so the board under it
//    does not also clear selection
//  - secondary roster/sprint/task-list failures surface as banners

const { getTaskMock } = vi.hoisted(() => ({
  getTaskMock: vi.fn(),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getTask: getTaskMock,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => {} }),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ currentUser: null }),
}));

// Panel is heavy — stub it so the overlay's hard gate is what we assert.
vi.mock("../components/board/TaskDetailPanel", () => ({
  TaskDetailPanel: ({
    task,
    onClose,
  }: {
    task: TaskItemResponse;
    onClose: () => void;
  }) => (
    <article data-testid="detail-panel">
      <h1>
        {task.title}
        <span className="sr-only">{task.title}</span>
      </h1>
      <button type="button" onClick={onClose}>
        panel-close
      </button>
    </article>
  ),
}));

import { TaskDetailOverlay } from "../components/board/TaskDetailOverlay";
import { invalidateApiCache } from "../lib/api";

const task = {
  id: "t1",
  projectId: "p1",
  key: "DEV-42",
  number: 42,
  title: "Surface the detail overlay",
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

function renderOverlay(overrides?: Partial<Parameters<typeof TaskDetailOverlay>[0]>) {
  const onClose = vi.fn();
  const onTaskChanged = vi.fn();
  const utils = render(
    <TaskDetailOverlay
      taskId="t1"
      workspaceId="ws-1"
      projectId="pr-9"
      currentUser={null}
      members={[]}
      membersFailed={false}
      onRetryMembers={vi.fn()}
      sprints={[]}
      sprintsFailed={false}
      onRetrySprints={vi.fn()}
      allTasks={[]}
      allTasksFailed={false}
      onRetryTasks={vi.fn()}
      onClose={onClose}
      onTaskChanged={onTaskChanged}
      {...overrides}
    />,
  );
  return { ...utils, onClose, onTaskChanged };
}

beforeEach(() => {
  getTaskMock.mockReset();
  invalidateApiCache();
  // Strip any board h1 so a later title-mirror assertion cannot false-pass
  // on leftover DOM from another suite.
  document.getElementById("devflow-content")?.remove();
});

describe("TaskDetailOverlay fail-closed loads", () => {
  it("requests the task-by-id endpoint with the ids it was given", async () => {
    getTaskMock.mockResolvedValue(task);
    renderOverlay();
    await waitFor(() =>
      expect(getTaskMock).toHaveBeenCalledWith("ws-1", "pr-9", "t1"),
    );
    expect(getTaskMock).toHaveBeenCalledTimes(1);
  });

  it("shows a skeleton while the first fetch is in flight", async () => {
    let resolveTask: (value: TaskItemResponse) => void = () => {};
    getTaskMock.mockImplementation(
      () =>
        new Promise<TaskItemResponse>((resolve) => {
          resolveTask = resolve;
        }),
    );
    renderOverlay();
    expect(screen.queryByTestId("detail-panel")).toBeNull();
    // Portal targets #devflow-content or body — neither is inside the RTL
    // container, so query the document.
    expect(document.querySelector(".skeleton")).not.toBeNull();
    resolveTask(task);
    await waitFor(() =>
      expect(screen.getByTestId("detail-panel")).toBeTruthy(),
    );
  });

  it("renders ErrorAlert + Retry and never an empty panel on error", async () => {
    getTaskMock.mockRejectedValue(new Error("boom: 500"));
    renderOverlay();
    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.retry" })).toBeTruthy();
    expect(screen.queryByTestId("detail-panel")).toBeNull();
  });

  it("renders secondary banners when members fail with null data", async () => {
    getTaskMock.mockResolvedValue(task);
    renderOverlay({ membersFailed: true });
    await screen.findByTestId("detail-panel");
    await waitFor(() => {
      expect(
        document.getElementById("task-detail-members-error"),
      ).not.toBeNull();
    });
  });
});

describe("TaskDetailOverlay modal chrome", () => {
  it("is a portal dialog with aria-modal, not a bare article", async () => {
    getTaskMock.mockResolvedValue(task);
    renderOverlay();
    await screen.findByTestId("detail-panel");
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Panel itself stays a non-modal article (taskdetailpanel.test).
    const article = document.querySelector("article");
    expect(article?.getAttribute("role")).toBeNull();
    expect(article?.className).not.toMatch(/fixed/);
  });

  it("Escape outside a field closes the overlay and does not reach the board", async () => {
    getTaskMock.mockResolvedValue(task);
    const { onClose } = renderOverlay();
    await screen.findByTestId("detail-panel");

    // Board-style window listener: must NOT fire if overlay stopPropagation
    // does its job (document listener runs first in the bubble phase).
    const boardSawEscape = vi.fn();
    window.addEventListener("keydown", boardSawEscape);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(boardSawEscape).not.toHaveBeenCalled();
    window.removeEventListener("keydown", boardSawEscape);
  });

  it("keeps Escape while typing in a field (title/comment editors)", async () => {
    getTaskMock.mockResolvedValue(task);
    const { onClose } = renderOverlay();
    await screen.findByTestId("detail-panel");

    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    input.remove();
  });

  it("backdrop close button dismisses the overlay", async () => {
    getTaskMock.mockResolvedValue(task);
    const { onClose } = renderOverlay();
    await screen.findByTestId("detail-panel");
    // Header X shares ui.closeDialogAria — the scrim is the testid'd one.
    const backdrop = screen.getByTestId("overlay-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
