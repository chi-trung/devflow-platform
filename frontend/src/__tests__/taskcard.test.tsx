import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { TaskCard } from "../components/board/TaskCard";
import type { TaskItemResponse } from "../types/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const apiMock = vi.fn();
vi.mock("../lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

// The card pushes its "copied" status message through the toast live region
// (WCAG 4.1.3); stub the hook so the test need not mount the provider.
const push = vi.fn();
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push }),
}));

function makeTask(overrides: Partial<TaskItemResponse> = {}): TaskItemResponse {
  return {
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
    ...overrides,
  } as TaskItemResponse;
}

function renderCard(task = makeTask(), onSelect = vi.fn()) {
  const utils = render(
    <TaskCard
      task={task}
      members={[]}
      onDelete={() => {}}
      onSelect={onSelect}
      workspaceId="w1"
      projectId="p1"
    />,
  );
  return { ...utils, onSelect };
}

describe("TaskCard keyboard access", () => {
  it("exposes the title as a focusable button that opens the task", () => {
    const { getByRole, onSelect } = renderCard();
    const title = getByRole("button", { name: "Probe task 1" });
    title.focus();
    expect(document.activeElement).toBe(title);
    fireEvent.click(title);
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("does not double-fire the card click when the title opens the task", () => {
    const { container, getByRole, onSelect } = renderCard();
    const title = getByRole("button", { name: "Probe task 1" });
    fireEvent.click(title);
    // The card's own onClick must not run a second onSelect for the same click.
    expect(onSelect).toHaveBeenCalledTimes(1);
    // A click on the card body (outside the title) still opens it.
    fireEvent.click(container.querySelector('[data-task-id="t1"]')!);
    expect(onSelect).toHaveBeenCalledTimes(2);
  });
});

// Regression: handleAddChild's catch used to be just a comment ("keep form
// open on error"), so a failed subtask POST looked like a slow success that
// simply never closed the card's inline form — the Add button un-spun and
// nothing else happened.
describe("TaskCard subtask creation failure feedback", () => {
  beforeEach(() => {
    push.mockClear();
    apiMock.mockReset();
  });

  it("surfaces an error toast when the subtask POST rejects", async () => {
    apiMock.mockRejectedValueOnce(new Error("offline"));
    const { getByLabelText } = renderCard();
    fireEvent.click(getByLabelText("board.addChildTaskAria"));
    fireEvent.change(getByLabelText("board.childTaskPlaceholder"), {
      target: { value: "Child probe" },
    });
    fireEvent.submit(getByLabelText("board.childTaskPlaceholder").closest("form")!);
    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith(
        "/workspaces/w1/projects/p1/tasks/t1/subtasks",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("subtask.addFailed", "error"));
  });

  it("leaves the toast untouched when the subtask POST succeeds", async () => {
    apiMock.mockResolvedValueOnce({});
    const { getByLabelText } = renderCard();
    fireEvent.click(getByLabelText("board.addChildTaskAria"));
    fireEvent.change(getByLabelText("board.childTaskPlaceholder"), {
      target: { value: "Child probe" },
    });
    fireEvent.submit(getByLabelText("board.childTaskPlaceholder").closest("form")!);
    await waitFor(() => expect(apiMock).toHaveBeenCalledOnce());
    // Success: no error toast of any kind.
    expect(push).not.toHaveBeenCalled();
  });
});
