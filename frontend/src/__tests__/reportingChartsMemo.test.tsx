import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ReportsPage re-renders on every keystroke in the from/to date inputs, and
// these chart bodies recompute their bar/dot geometry and y-tick arrays on
// each of those renders. All three render sites pass only `data={...}`, an
// already-stable useApi response object, so the memo wrapper is the whole fix.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        const joined = Object.values(opts).map(String).join(",");
        if (joined) return `${k}:${joined}`;
      }
      return k;
    },
  }),
}));

import { VelocityChart, __velocityChartRenders, __resetVelocityChartRenders } from "../components/reporting/VelocityChart";
import { VelocityTrendChart, __velocityTrendChartRenders, __resetVelocityTrendChartRenders } from "../components/reporting/VelocityTrendChart";
import { CycleLeadTimeChart, __cycleLeadTimeChartRenders, __resetCycleLeadTimeChartRenders } from "../components/reporting/CycleLeadTimeChart";
import type { VelocityResponse, VelocityHistoryResponse, CycleLeadTimeResponse } from "../types/api";

const VELOCITY: VelocityResponse = {
  sprints: [
    { sprintId: "s1", sprintName: "Sprint 1", completedTasks: 4, totalTasks: 6, completionRate: 0.67 },
    { sprintId: "s2", sprintName: "Sprint 2", completedTasks: 6, totalTasks: 6, completionRate: 1 },
  ],
  averageCompletionRate: 0.83,
};

const VELOCITY_HISTORY: VelocityHistoryResponse = {
  points: [
    { sprintId: "s1", sprintName: "Sprint 1", totalStoryPoints: 13, completedStoryPoints: 8, endDateUtc: "2026-09-05T00:00:00Z" },
    { sprintId: "s2", sprintName: "Sprint 2", totalStoryPoints: 15, completedStoryPoints: 12, endDateUtc: null },
  ],
  averageCompleted: 10,
  averageTotal: 14,
};

const CYCLE_LEAD: CycleLeadTimeResponse = {
  cycleTimeP50: 2.5,
  cycleTimeP90: 6.0,
  leadTimeP50: 4.0,
  leadTimeP90: 9.5,
  tasks: [
    { taskId: "t1", title: "Task one", cycleTimeDays: 2, leadTimeDays: 4 },
    { taskId: "t2", title: "Task two", cycleTimeDays: null, leadTimeDays: null },
  ],
};

function resetAll() {
  __resetVelocityChartRenders();
  __resetVelocityTrendChartRenders();
  __resetCycleLeadTimeChartRenders();
}

describe("the reporting charts are memoised against date-range keystrokes", () => {
  beforeEach(resetAll);

  it("each chart renders once on mount and draws its geometry", () => {
    render(<VelocityChart data={VELOCITY} />);
    render(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    render(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(__velocityChartRenders(), "VelocityChart should render exactly once").toBe(1);
    expect(__velocityTrendChartRenders(), "VelocityTrendChart should render exactly once").toBe(1);
    expect(__cycleLeadTimeChartRenders(), "CycleLeadTimeChart should render exactly once").toBe(1);
  });

  it("does not re-run a body for a no-op parent re-render", () => {
    const v = render(<VelocityChart data={VELOCITY} />);
    v.rerender(<VelocityChart data={VELOCITY} />);
    expect(__velocityChartRenders(), "VelocityChart body re-ran for unchanged props").toBe(1);

    const h = render(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    h.rerender(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    expect(__velocityTrendChartRenders(), "VelocityTrendChart body re-ran for unchanged props").toBe(1);

    const c = render(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    c.rerender(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    expect(__cycleLeadTimeChartRenders(), "CycleLeadTimeChart body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the response object changes (no over-holding)", () => {
    const v = render(<VelocityChart data={VELOCITY} />);
    v.rerender(<VelocityChart data={{ ...VELOCITY, averageCompletionRate: 0.5 }} />);
    expect(__velocityChartRenders(), "a new response object must re-render").toBe(2);

    const h = render(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    h.rerender(<VelocityTrendChart data={{ ...VELOCITY_HISTORY, averageCompleted: 11 }} />);
    expect(__velocityTrendChartRenders(), "a new response object must re-render").toBe(2);

    const c = render(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    c.rerender(<CycleLeadTimeChart data={{ ...CYCLE_LEAD, cycleTimeP50: 3 }} />);
    expect(__cycleLeadTimeChartRenders(), "a new response object must re-render").toBe(2);
  });

  it("renders each empty state without its chart svg", () => {
    resetAll();
    const v = render(<VelocityChart data={{ sprints: [], averageCompletionRate: 0 }} />);
    expect(v.getByText("reports.noSprintsVelocity")).toBeInTheDocument();
    expect(v.queryByRole("img")).not.toBeInTheDocument();
    expect(__velocityChartRenders()).toBe(1);

    resetAll();
    const h = render(<VelocityTrendChart data={{ points: [], averageCompleted: 0, averageTotal: 0 }} />);
    expect(h.getByText("reports.noVelocityHistory")).toBeInTheDocument();
    expect(h.queryByRole("img")).not.toBeInTheDocument();
    expect(__velocityTrendChartRenders()).toBe(1);

    resetAll();
    const c = render(<CycleLeadTimeChart data={{ ...CYCLE_LEAD, tasks: [] }} />);
    expect(c.getByText("reports.noCycleLeadData")).toBeInTheDocument();
    expect(c.queryByRole("img")).not.toBeInTheDocument();
    expect(__cycleLeadTimeChartRenders()).toBe(1);
  });

  it("does not re-run a body when a sibling re-renders after settling", () => {
    const v = render(<VelocityChart data={VELOCITY} />);
    resetAll();
    v.rerender(<VelocityChart data={VELOCITY} />);
    expect(__velocityChartRenders(), "settled no-op rerender must not re-run the body").toBe(0);

    const h = render(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    resetAll();
    h.rerender(<VelocityTrendChart data={VELOCITY_HISTORY} />);
    expect(__velocityTrendChartRenders(), "settled no-op rerender must not re-run the body").toBe(0);

    const c = render(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    resetAll();
    c.rerender(<CycleLeadTimeChart data={CYCLE_LEAD} />);
    expect(__cycleLeadTimeChartRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
