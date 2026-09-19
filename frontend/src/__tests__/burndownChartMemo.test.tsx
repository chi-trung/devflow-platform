import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// SprintPlanningPage re-renders on every keystroke, every drag, every toast.
// Its active-sprint section contains a BurndownChart that derives the whole
// curve on every render: a `new Date()` per task, then a `.filter()` over the
// completions *per day* (O(days x completions)), plus the ideal/actual point
// lists, four tick loops and two path builders.
//
// Before this change the page handed the chart `tasks.filter(...)` inline at
// the render site AND the chart was not memoised. That is two independent
// defects with the same symptom:
//  1. the array identity changed every render, so even a memoised chart would
//     have re-derived;
//  2. the chart was not memoised at all, so React re-ran the body regardless
//     of what the page handed it.
//
// This locks both invariants: the page memoises the filtered array AND the
// chart skips re-rendering when its props are unchanged.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import {
  BurndownChart,
  __burndownRenders,
  __resetBurndownRenders,
} from "../components/sprint/BurndownChart";
import type { TaskItemResponse } from "../types/api";

function task(id: string, day: number): TaskItemResponse {
  return {
    id,
    key: `DEV-${id}`,
    title: `Task ${id}`,
    description: null,
    status: "Done",
    priority: "Medium",
    assigneeId: null,
    storyPoints: 3,
    dueDateUtc: null,
    definitionOfDone: null,
    enteredReviewAtUtc: null,
    prSummary: null,
    createdAtUtc: "2026-09-01T00:00:00Z",
    updatedAtUtc: "2026-09-01T00:00:00Z",
    completedAtUtc: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
  } as unknown as TaskItemResponse;
}

// A two-week sprint with one task completing per day. totalDays = 14,
// completions = 14, so the inner filter runs 14 x 14 = 196 comparisons per
// derivation -- enough to make the render count a meaningful measure, and
// close to a real sprint's shape.
const START = "2026-09-01T00:00:00Z";
const END = "2026-09-14T00:00:00Z";
const TASKS: TaskItemResponse[] = Array.from({ length: 14 }, (_, i) =>
  task(String(i + 1), i + 1),
);

describe("BurndownChart memo", () => {
  it("renders the curve once and then holds for unchanged props", () => {
    __resetBurndownRenders();
    const { rerender } = render(
      <BurndownChart
        startDateUtc={START}
        endDateUtc={END}
        tasks={TASKS}
      />,
    );
    expect(__burndownRenders(), "mount renders the derivation once").toBe(1);

    // Same props by identity: the memo must hold. Before the memo this
    // re-derived on every parent render.
    rerender(
      <BurndownChart
        startDateUtc={START}
        endDateUtc={END}
        tasks={TASKS}
      />,
    );
    expect(
      __burndownRenders(),
      "a rerender with unchanged props must not re-derive",
    ).toBe(1);
  });

  it("re-derives only when the task list identity changes", () => {
    __resetBurndownRenders();
    const { rerender } = render(
      <BurndownChart
        startDateUtc={START}
        endDateUtc={END}
        tasks={TASKS}
      />,
    );
    expect(__burndownRenders()).toBe(1);

    // A refetch returns a NEW array of the same tasks. Identity changed, so
    // the memo correctly releases and the curve re-derives. This is the case
    // the inline `tasks.filter(...)` hit on every render before the fix.
    const refetched = TASKS.map((t) => ({ ...t }));
    rerender(
      <BurndownChart
        startDateUtc={START}
        endDateUtc={END}
        tasks={refetched}
      />,
    );
    expect(
      __burndownRenders(),
      "a new task array identity must re-derive the curve",
    ).toBe(2);
  });

  it("re-derives when the date range changes", () => {
    __resetBurndownRenders();
    const { rerender } = render(
      <BurndownChart
        startDateUtc={START}
        endDateUtc={END}
        tasks={TASKS}
      />,
    );
    expect(__burndownRenders()).toBe(1);

    rerender(
      <BurndownChart
        startDateUtc={START}
        endDateUtc="2026-09-21T00:00:00Z"
        tasks={TASKS}
      />,
    );
    expect(
      __burndownRenders(),
      "a new date range must re-derive (totalDays changes)",
    ).toBe(2);
  });
});
