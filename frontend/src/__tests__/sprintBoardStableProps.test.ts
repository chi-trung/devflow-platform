import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SprintBoard is memoised (see sprintBoardMemo.test.tsx for the render-count
// proof), so every prop reaching it must be stable or the memo releases for
// nothing. SprintPlanningPage is SprintBoard's only call site, so this guards
// the whole surface.
//
// These are greppable invariants rather than render counts: an inline arrow or
// an inline `.filter()` at the render site is a fresh identity every render,
// and that is invisible to any behaviour test.

const PAGES = join(__dirname, "..", "pages");
const COMPONENTS = join(__dirname, "..", "components");

function page(): string {
  return readFileSync(join(PAGES, "SprintPlanningPage.tsx"), "utf8");
}

describe("SprintPlanningPage hands SprintBoard stable props", () => {
  const content = page();

  it("is the only place SprintBoard is rendered", () => {
    const sites = content.match(/<SprintBoard\b/g);
    expect(sites, "SprintBoard render sites").toHaveLength(1);
  });

  it("exports SprintBoard as a memo", () => {
    // The pair is both halves: stable handlers into an un-memoised SprintBoard
    // are dead weight (the body re-runs regardless of prop identity).
    const board = readFileSync(join(COMPONENTS, "sprint", "SprintBoard.tsx"), "utf8");
    expect(board).toMatch(/export const SprintBoard = memo\(function SprintBoard\(/);
  });

  it("does not hand SprintBoard an inline arrow for onAssign/onRemove", () => {
    // The page wraps both in a void-async call, so the guard is the shape that
    // would churn the identity, not the void wrapper.
    expect(content).not.toMatch(/onAssign=\{\(taskId, sprintId\) =>/);
    expect(content).toMatch(/onAssign=\{handleAssign\}/);
    expect(content).not.toMatch(/onRemove=\{\(taskId, sprintId\) =>/);
    expect(content).toMatch(/onRemove=\{handleRemoveFromSprint\}/);

    const startA = content.indexOf("const handleAssign = ");
    expect(startA, "handleAssign is defined").toBeGreaterThan(-1);
    expect(
      content.slice(startA, startA + 80),
      "handleAssign must be a useCallback",
    ).toContain("useCallback");

    const startR = content.indexOf("const handleRemoveFromSprint = ");
    expect(startR, "handleRemoveFromSprint is defined").toBeGreaterThan(-1);
    expect(
      content.slice(startR, startR + 90),
      "handleRemoveFromSprint must be a useCallback",
    ).toContain("useCallback");
  });

  it("the sprints prop is a memo, not a per-render .filter()", () => {
    // SprintBoard filters the task list per sprint column, so a fresh sprints
    // array per render re-renders every column for nothing.
    const start = content.indexOf("const planning = ");
    expect(start, "planning is derived").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 60),
      "planning must be a useMemo",
    ).toContain("useMemo");
  });

  it("the sprints fallback is a module-level constant, not an inline []", () => {
    // `sprints ?? []` is a fresh array every render while the fetch is in
    // flight, which releases the memo for the whole loading window.
    const start = content.indexOf("const allSprints = ");
    expect(start, "allSprints is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 90),
      "allSprints must fall back to EMPTY_SPRINTS",
    ).toMatch(/EMPTY_SPRINTS/);
    expect(content).toMatch(/const EMPTY_SPRINTS: SprintResponse\[\] = \[\]/);
  });

  it("SprintBoard no longer filters the task list per sprint", () => {
    // The body is quadratic without this: the grouping memo replaced the
    // per-sprint scan. This guards against the old shape creeping back.
    const board = readFileSync(join(COMPONENTS, "sprint", "SprintBoard.tsx"), "utf8");
    const start = board.indexOf("sprints.map((sprint) => {");
    expect(start, "the sprint column map moved").toBeGreaterThan(-1);
    const column = board.slice(start, start + 260);
    expect(column).not.toMatch(/tasks\.filter\(/);
    expect(column).toMatch(/tasksBySprint\.get\(sprint\.id\)/);
  });
});
