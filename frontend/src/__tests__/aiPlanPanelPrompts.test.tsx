import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { AiPlanPanel } from "../components/ai/AiPlanPanel";

// Contract for planner presets + free prompt:
//  - no plan → preset chips + free composer + plain Ask AI
//  - chip click → planAiTask(w, p, taskId, presetText)
//  - free-text send → planAiTask(..., draft)
//  - Regenerate re-sends lastPrompt
//  - loadError still gates the whole generate block (swallowedReads contract)

const { planAiTaskMock, getLatestAiPlanMock, applyAiPlanMock } = vi.hoisted(
  () => ({
    planAiTaskMock: vi.fn(),
    getLatestAiPlanMock: vi.fn(),
    applyAiPlanMock: vi.fn(),
  }),
);

vi.mock("../lib/api", () => ({
  planAiTask: planAiTaskMock,
  getLatestAiPlan: getLatestAiPlanMock,
  applyAiPlan: applyAiPlanMock,
}));

// Stable identity: a fresh `t` each render recreates loadPlan (its dep),
// re-runs the load effect, and flips `loading` true — which unmounts the
// composer mid-interaction (Enter then hits a detached node).
const tMock = (k: string) => k;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => {} }),
}));

const plan = {
  id: "plan-1",
  taskId: "t1",
  projectId: "p1",
  status: "Pending",
  applied: false,
  summary: "Break it down",
  steps: ["Step 1"],
  subtasks: [
    { title: "Sub", description: "Do it", priority: "High" },
  ],
  definitionOfDone: ["Tests pass"],
  createdAtUtc: "2026-09-23T00:00:00Z",
};

function renderPanel() {
  return render(
    <AiPlanPanel
      workspaceId="w1"
      projectId="p1"
      taskId="t1"
      onChanged={() => {}}
    />,
  );
}

beforeEach(() => {
  planAiTaskMock.mockReset();
  getLatestAiPlanMock.mockReset();
  applyAiPlanMock.mockReset();
  // Default: no saved plan → generate UI is visible.
  getLatestAiPlanMock.mockResolvedValue(null);
  planAiTaskMock.mockResolvedValue(plan);
});

describe("AiPlanPanel presets + free prompt", () => {
  it("renders preset chips and the free composer when no plan exists", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.queryByText("common.loading")).toBeNull(),
    );
    expect(screen.getByText("ai.planPresetBreakdown")).toBeTruthy();
    expect(screen.getByText("ai.planPresetAcceptance")).toBeTruthy();
    expect(screen.getByLabelText("ai.planPlaceholder")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ai.planSend" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ai.askAiToPlan" })).toBeTruthy();
  });

  it("sends the preset text as the prompt on chip click", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.queryByText("common.loading")).toBeNull(),
    );
    fireEvent.click(screen.getByText("ai.planPresetBreakdown"));
    await waitFor(() =>
      expect(planAiTaskMock).toHaveBeenCalledWith(
        "w1",
        "p1",
        "t1",
        "ai.planPresetBreakdown",
      ),
    );
  });

  it("sends free text on Enter", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.queryByText("common.loading")).toBeNull(),
    );
    const textarea = screen.getByLabelText("ai.planPlaceholder");
    fireEvent.change(textarea, { target: { value: "Focus on migrations" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() =>
      expect(planAiTaskMock).toHaveBeenCalledWith(
        "w1",
        "p1",
        "t1",
        "Focus on migrations",
      ),
    );
  });

  // Separate mount: after Enter a plan exists, so the generate block
  // (composer + send) unmounts — Shift+Enter / send must re-render fresh.
  it("does not send on Shift+Enter and sends on the send button", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.queryByText("common.loading")).toBeNull(),
    );
    const textarea = screen.getByLabelText("ai.planPlaceholder");
    fireEvent.change(textarea, { target: { value: "Focus on migrations" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(planAiTaskMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "ai.planSend" }));
    await waitFor(() =>
      expect(planAiTaskMock).toHaveBeenCalledWith(
        "w1",
        "p1",
        "t1",
        "Focus on migrations",
      ),
    );
  });

  it("Regenerate re-sends the last prompt", async () => {
    getLatestAiPlanMock.mockResolvedValue(plan);
    renderPanel();
    // Plan already exists → no chips; Regenerate is the path.
    const regen = await screen.findByRole("button", { name: "ai.regenerate" });
    // First generate never ran in this mount — lastPrompt is null → prompt omitted.
    fireEvent.click(regen);
    await waitFor(() =>
      expect(planAiTaskMock).toHaveBeenCalledWith("w1", "p1", "t1", null),
    );
  });

  it("plain Ask AI omits the prompt (null)", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.queryByText("common.loading")).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "ai.askAiToPlan" }));
    await waitFor(() =>
      expect(planAiTaskMock).toHaveBeenCalledWith("w1", "p1", "t1", null),
    );
  });

  it("keeps loadError gating the generate block", async () => {
    getLatestAiPlanMock.mockRejectedValue(new Error("boom"));
    renderPanel();
    const alert = await screen.findByRole("alert");
    expect(alert.id).toBe("aiplanpanel-load-error");
    // No overwrite affordance while the read is errored.
    expect(screen.queryByRole("button", { name: "ai.askAiToPlan" })).toBeNull();
    expect(screen.queryByText("ai.planPresetBreakdown")).toBeNull();
    expect(
      screen.getByRole("button", { name: "common.retry" }),
    ).toBeTruthy();
  });
});
