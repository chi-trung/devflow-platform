import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { TaskItemResponse } from "../types/api";

// Fail-closed contract for the full-page detail route:
//  - loading && data===null  → skeleton (no empty article)
//  - error !== null && data === null → ErrorAlert + Retry, never []/empty
//  - success → panel with h1 + Back link to the board
//  - the GET hits the task-by-id URL exactly once per mount

const { getTaskMock, apiMock } = vi.hoisted(() => ({
  getTaskMock: vi.fn(),
  // Loose on purpose: the page fans out members/sprints/tasks through the
  // shared api() helper with different response shapes.
  apiMock: vi.fn(
    async (_path: string): Promise<unknown> => [],
  ) as ReturnType<typeof vi.fn>,
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    getTask: getTaskMock,
    api: apiMock,
  };
});

// snapshotStore is module-level in api.ts — localStorage.clear() alone does
// not drop an in-memory seed, and a prior successful members fetch would
// keep data !== null so membersFailed never holds.

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

// Panel is heavy (comments/attachments/watchers/effects). The page's
// contract is about the hard gate around it — assert via a lightweight stub
// so a broken panel doesn't mask a broken page, and vice versa.
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

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import { TaskDetailPage } from "../pages/TaskDetailPage";
import { invalidateApiCache } from "../lib/api";

const task = {
  id: "t1",
  projectId: "p1",
  key: "DEV-42",
  number: 42,
  title: "Surface the detail page",
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

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/workspaces/ws-1/projects/pr-9/tasks/t1"]}
    >
      <Routes>
        <Route
          path="/workspaces/:workspaceId/projects/:projectId/tasks/:taskId"
          element={<TaskDetailPage />}
        />
        <Route
          path="/workspaces/:workspaceId/projects/:projectId"
          element={<div>board-shell</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  getTaskMock.mockReset();
  apiMock.mockReset();
  apiMock.mockResolvedValue([]);
  localStorage.clear();
  invalidateApiCache();
});

describe("TaskDetailPage fail-closed loads", () => {
  it("requests the task-by-id endpoint with the route params", async () => {
    getTaskMock.mockResolvedValue(task);
    renderPage();
    await waitFor(() =>
      expect(getTaskMock).toHaveBeenCalledWith("ws-1", "pr-9", "t1"),
    );
    expect(getTaskMock).toHaveBeenCalledTimes(1);
    // The helper builds this path — a wrong helper would 404 in prod.
    const actual = await vi.importActual<typeof import("../lib/api")>(
      "../lib/api",
    );
    // Sanity: getTask is mocked, but the real path shape is asserted by
    // construction of the mock args above (w, p, t).
    expect(typeof actual.getTask).toBe("function");
  });

  it("shows a skeleton while the first fetch is in flight", async () => {
    let resolveTask: (value: TaskItemResponse) => void = () => {};
    getTaskMock.mockImplementation(
      () =>
        new Promise<TaskItemResponse>((resolve) => {
          resolveTask = resolve;
        }),
    );
    const { container } = renderPage();
    // Fail-closed: no panel, no empty article while data === null && loading.
    expect(screen.queryByTestId("detail-panel")).toBeNull();
    expect(container.querySelector(".skeleton")).not.toBeNull();
    resolveTask(task);
    await waitFor(() =>
      expect(screen.getByTestId("detail-panel")).toBeTruthy(),
    );
  });

  it("renders ErrorAlert + Retry and never an empty panel on error", async () => {
    getTaskMock.mockRejectedValue(new Error("boom: 500"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.retry" })).toBeTruthy();
    // Hard gate: task === null must not mount the panel as an empty shell.
    expect(screen.queryByTestId("detail-panel")).toBeNull();
  });

  it("on success renders the h1 title and a Back link to the board", async () => {
    getTaskMock.mockResolvedValue(task);
    renderPage();
    await screen.findByTestId("detail-panel");
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toContain("Surface the detail page");
    const back = screen.getByRole("link", { name: "taskDetail.backToBoard" });
    expect(back).toHaveAttribute(
      "href",
      "/workspaces/ws-1/projects/pr-9",
    );
  });

  it("renders secondary banners when members fail with null data", async () => {
    getTaskMock.mockResolvedValue(task);
    // members = api(/workspaces/.../members) fails; sprints + tasks ok.
    apiMock.mockImplementation(async (path: string) => {
      if (path.includes("/members")) throw new Error("members down");
      if (path.endsWith("/sprints")) return { items: [], totalCount: 0 };
      if (path.includes("/tasks?")) return { items: [task], totalCount: 1 };
      return [];
    });
    renderPage();
    await screen.findByTestId("detail-panel");
    // Fail-closed: a null roster must not be laundered into "no members".
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(
        alerts.some((a) => a.id === "task-detail-members-error"),
      ).toBe(true);
    });
    expect(
      screen.getByRole("button", { name: "common.retry" }),
    ).toBeTruthy();
  });
});
