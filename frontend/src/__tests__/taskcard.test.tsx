import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TaskCard } from "../components/board/TaskCard";
import type { TaskItemResponse } from "../types/api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock("../lib/api", () => ({
  api: () => Promise.resolve({}),
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
