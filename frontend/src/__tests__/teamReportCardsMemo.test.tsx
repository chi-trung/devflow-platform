import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// ReportsPage re-renders on every keystroke in the from/to date inputs, and
// this body scanned the whole workspace roster once per report member
// (members.find() inside the row map) on each of those renders.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // tasksDone passes { done, total }.
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        if (k === "reports.tasksDone") {
          return `${opts.done}/${opts.total}`;
        }
      }
      return k;
    },
  }),
}));

import { TeamReportCards, __teamReportCardsRenders, __resetTeamReportCardsRenders } from "../components/reporting/TeamReportCards";
import type { TeamReportResponse, WorkspaceMemberResponse } from "../types/api";

function member(userId: string, overrides: Partial<WorkspaceMemberResponse> = {}): WorkspaceMemberResponse {
  return {
    userId,
    email: `${userId}@example.com`,
    username: userId,
    displayName: `Display ${userId}`,
    role: "Member",
    ...overrides,
  };
}

function stats(userId: string, name: string) {
  return {
    userId,
    userName: name,
    tasksAssigned: 3,
    tasksCompleted: 1,
    totalMinutesLogged: 120,
    inProgressCount: 2,
    avgCycleTimeDays: 4.5,
  };
}

function report(overrides: Partial<TeamReportResponse> = {}): TeamReportResponse {
  return {
    members: [stats("u1", "Alice"), stats("u2", "Bob")],
    totalTasks: 6,
    totalCompleted: 2,
    totalMinutesLogged: 240,
    trends: { completedDelta: 1, cycleTimeDelta: -0.5 },
    ...overrides,
  };
}

function props(overrides: { data?: TeamReportResponse; members?: WorkspaceMemberResponse[] } = {}) {
  return {
    data: overrides.data ?? report(),
    members: overrides.members ?? [member("u1"), member("u2")],
  };
}

describe("TeamReportCards is memoised against parent re-renders", () => {
  beforeEach(() => {
    __resetTeamReportCardsRenders();
  });

  it("renders once on mount and resolves names through the roster map", () => {
    render(<TeamReportCards {...props()} />);
    // displayName wins over the report's userName.
    expect(screen.getByText("Display u1")).toBeInTheDocument();
    expect(screen.getByText("Display u2")).toBeInTheDocument();
    expect(__teamReportCardsRenders(), "TeamReportCards should render exactly once on mount").toBe(1);
  });

  it("does not re-run the body for a no-op parent re-render", () => {
    const p = props();
    const { rerender } = render(<TeamReportCards {...p} />);
    expect(__teamReportCardsRenders()).toBe(1);

    // Same props by identity: this is what the page's keystroke re-render looks
    // like when data/members are both stable.
    rerender(<TeamReportCards {...p} />);
    expect(__teamReportCardsRenders(), "TeamReportCards body re-ran for unchanged props").toBe(1);
  });

  it("re-renders when the report data changes (the memo does not over-hold)", () => {
    const members = [member("u1"), member("u2")];
    const { rerender } = render(<TeamReportCards data={report()} members={members} />);
    expect(__teamReportCardsRenders()).toBe(1);

    rerender(<TeamReportCards data={report({ totalCompleted: 3 })} members={members} />);
    expect(__teamReportCardsRenders(), "a new report object must re-render").toBe(2);
  });

  it("re-renders when the members array identity changes", () => {
    const data = report();
    const { rerender } = render(<TeamReportCards data={data} members={[member("u1"), member("u2")]} />);
    expect(__teamReportCardsRenders()).toBe(1);

    rerender(<TeamReportCards data={data} members={[member("u1"), member("u2"), member("u3")]} />);
    expect(__teamReportCardsRenders(), "a new members array must re-render").toBe(2);
  });

  it("falls back to the report userName when the member has no roster profile", () => {
    render(<TeamReportCards data={report()} members={[member("u2")]} />);
    // u1 is absent from the roster: userName, then the common.member fallback.
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Display u2")).toBeInTheDocument();
  });

  it("falls back to common.member when neither roster nor report has a name", () => {
    render(
      <TeamReportCards
        data={report({ members: [stats("u9", "")] })}
        members={[]}
      />,
    );
    expect(screen.getByText("common.member")).toBeInTheDocument();
  });

  it("renders the empty state and skips the table when the report has no members", () => {
    const { container } = render(<TeamReportCards data={report({ members: [] })} members={[member("u1")]} />);
    expect(screen.getByText("reports.noTeamActivity")).toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
    expect(__teamReportCardsRenders()).toBe(1);
  });

  it("does not re-run the body when a sibling re-renders after settling", () => {
    const p = props();
    const { rerender } = render(<TeamReportCards {...p} />);
    expect(__teamReportCardsRenders()).toBe(1);

    __resetTeamReportCardsRenders();
    rerender(<TeamReportCards {...p} />);
    expect(__teamReportCardsRenders(), "settled no-op rerender must not re-run the body").toBe(0);
  });
});
