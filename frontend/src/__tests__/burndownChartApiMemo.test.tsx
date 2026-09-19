import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ReportsPage re-renders on every keystroke in the from/to date inputs, and
// this body rebuilds two SVG path strings, a y-tick array and an x-tick day
// list on each of those renders.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // rangeHeader / pointTitle / hoverPoint pass object options.
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        const joined = Object.values(opts).map(String).join(",");
        if (joined) return `${k}:${joined}`;
      }
      return k;
    },
  }),
}));

import { BurndownChartApi, __burndownChartApiRenders, __resetBurndownChartApiRenders } from "../components/reporting/BurndownChartApi";
import type { BurndownResponse } from "../types/api";

function point(date: string, remainingTasks: number, idealRemaining: number) {
  return { date, remainingTasks, idealRemaining };
}

function report(overrides: Partial<BurndownResponse> = {}): BurndownResponse {
  return {
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    totalTasks: 8,
    points: [
      point("2026-09-01", 8, 8),
      point("2026-09-02", 6, 6),
      point("2026-09-03", 5, 4),
      point("2026-09-04", 2, 2),
      point("2026-09-05", 0, 0),
    ],
    ...overrides,
  };
}

describe("BurndownChartApi is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetBurndownChartApiRenders();
  });

  it("renders once on mount and draws the actual and ideal paths", () => {
    render(<BurndownChartApi data={report()} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(__burndownChartApiRenders(), "BurndownChartApi should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const data = report();
    const { rerender } = render(<BurndownChartApi data={data} />);
    expect(__burndownChartApiRenders()).toBe(1);

    // Same props by identity: this is what the page's keystroke re-render looks
    // like when the burndown response is unchanged.
    rerender(<BurndownChartApi data={data} />);
    expect(__burndownChartApiRenders(), "BurndownChartApi body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the report data changes (the memo does not over-hold)", () => {
    const { rerender } = render(<BurndownChartApi data={report()} />);
    expect(__burndownChartApiRenders()).toBe(1);

    rerender(<BurndownChartApi data={report({ totalTasks: 10 })} />);
    expect(__burndownChartApiRenders(), "a new report object must re-render").toBe(2);
  });

  it("keeps hover state internal without re-running the parent's body", () => {
    const data = report();
    render(<BurndownChartApi data={data} />);
    expect(__burndownChartApiRenders()).toBe(1);

    // Hovering is local state: it must not look like a data change to the
    // parent, and the hover readout must appear.
    const svg = screen.getByRole("img");
    fireEvent.mouseEnter(svg.querySelector("rect") as never);
    expect(screen.getByText(/reports\.hoverPoint/)).toBeInTheDocument();
  });

  it("renders the empty state and skips the chart when there are no points", () => {
    render(<BurndownChartApi data={report({ points: [] })} />);
    expect(screen.getByText("reports.noBurndownData")).toBeInTheDocument();
    // EmptyState ships its own icon svg, so assert the chart role is absent.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(__burndownChartApiRenders()).toBe(1);
  });

  it("does not re-run the body when a sibling re-renders after settling", () => {
    const data = report();
    const { rerender } = render(<BurndownChartApi data={data} />);
    expect(__burndownChartApiRenders()).toBe(1);

    __resetBurndownChartApiRenders();
    rerender(<BurndownChartApi data={data} />);
    expect(__burndownChartApiRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
