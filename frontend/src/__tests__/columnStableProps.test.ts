import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Column is memoised (see columnMemo.test.ts for the render-count proof), so
// every prop reaching it must be stable or the memo releases for nothing.
// BoardPage is Column's only call site, so this guards the whole surface.
//
// The guards are greppable invariants rather than render counts: an inline
// arrow or an inline `?? []` at the render site is a fresh identity every
// render, and that is invisible to any behaviour test.

const PAGES = join(__dirname, "..", "pages");

function source(): string {
  return readFileSync(join(PAGES, "BoardPage.tsx"), "utf8");
}

describe("BoardPage hands Column stable props", () => {
  const content = source();

  it("is the only place Column is rendered", () => {
    const sites = content.match(/<Column\b/g);
    expect(sites, "Column render sites").toHaveLength(1);
  });

  it("exports Column as a memo", () => {
    // The pair is both halves: a stable tasks array into an un-memoised Column
    // is dead weight (the body re-runs regardless of prop identity).
    const column = readFileSync(
      join(__dirname, "..", "components", "board", "Column.tsx"),
      "utf8",
    );
    expect(column).toMatch(/export const Column = memo\(function Column\(/);
  });

  it("does not hand Column an inline arrow for the drop handler", () => {
    // moveTask is a plain inner function (it reads tasks/blockedTaskIds by
    // closure), so it cannot be the callback itself; the wrapper around it
    // must be memoised instead.
    expect(content).not.toMatch(/onDropTask=\{\(taskId, next, beforeId\) =>/);
    expect(content).toMatch(/onDropTask=\{handleDropTask\}/);
    // The wrapper must be a useCallback, not a plain const arrow.
    const start = content.indexOf("const handleDropTask = ");
    expect(start, "handleDropTask is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 60),
      "handleDropTask must be a useCallback",
    ).toContain("useCallback");
  });

  it("does not hand Column an inline arrow for select-all", () => {
    // Per-status binding has to happen inside the map (status is only in scope
    // there), so the factory itself is memoised and called once per column.
    expect(content).not.toMatch(
      /onSelectAllInColumn=\{\(select\) => handleSelectAllInColumn/,
    );
    expect(content).toMatch(/onSelectAllInColumn=\{makeSelectAllInColumn\(status\)\}/);
    const start = content.indexOf("const makeSelectAllInColumn = ");
    expect(start, "makeSelectAllInColumn is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 70),
      "makeSelectAllInColumn must be a useCallback",
    ).toContain("useCallback");
  });

  it("uses the module-level empty-array constants, not inline literals", () => {
    // A fresh `?? []` per render defeats the memo for the whole loading
    // window. These constants already existed for Column's own memos; now
    // they also keep the memo itself holding.
    const colStart = content.indexOf("tasks={tasksByStatus.get(status) ?? EMPTY_TASKS}");
    expect(colStart, "the Column render site moved").toBeGreaterThan(-1);
    const site = content.slice(colStart, colStart + 500);
    expect(site).not.toMatch(/\?\? \[\]/);
    expect(site).toMatch(/members=\{members \?\? EMPTY_MEMBERS\}/);
    expect(site).toMatch(/epics=\{epics \?\? EMPTY_EPICS\}/);
  });

  it("the other Column props are stable by construction", () => {
    // Not every prop needs a guard -- these are stable without one:
    //   onDelete/onSelect/onToggleSelect/onEstimationSaved: setState from
    //     useState or a useCallback, both identity-stable across renders.
    //   swimlaneMode/selectedIds/blockedTaskIds/workspaceId/projectId: state
    //     or useMemo values.
    //   customFieldsByTaskId ?? undefined: `undefined` is a primitive, so the
    //     fallback does not create identity churn the way `?? {}` would.
    const colStart = content.indexOf("tasks={tasksByStatus.get(status) ?? EMPTY_TASKS}");
    const site = content.slice(colStart, colStart + 900);
    expect(site).toMatch(/onDelete=\{setPendingDelete\}/);
    expect(site).toMatch(/onSelect=\{setSelectedTaskId\}/);
    expect(site).toMatch(/onToggleSelect=\{toggleSelect\}/);
    expect(site).toMatch(/onEstimationSaved=\{handleEstimationSaved\}/);
    expect(site).toMatch(/customFieldsByTaskId=\{customFieldsByTaskId \?\? undefined\}/);
  });
});
