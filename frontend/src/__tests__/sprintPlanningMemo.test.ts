import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SprintPlanningPage's active-sprint section re-renders on every keystroke and
// every drag-to-sprint. Before this change it computed the chart's input
// inline at the render site -- `tasks.filter((t) => t.sprintId === active.id)`
// -- plus two more filters for the progress bar. Three full scans of the task
// list per render, and the first one handed the chart a fresh array identity
// every time.
//
// This locks the greppable invariants:
//  1. `activeTasks` is a useMemo whose dependency list names `tasks` and the
//     active sprint (an empty or stale list is a correctness bug -- a task
//     moving into the sprint would silently not appear on the curve).
//  2. the render site passes `activeTasks`, not an inline filter;
//  3. the empty fallback is a module-level constant, so the no-active-sprint
//     case does not hand the chart a fresh array per render;
//  4. `activeProgress` memoises the two counts the progress bar needs, so the
//     inline filters do not come back.

const PAGES = join(__dirname, "..", "pages");

function source(): string {
  return readFileSync(join(PAGES, "SprintPlanningPage.tsx"), "utf8");
}

/** The body of `const name = useMemo(() => ..., [deps]);`. */
function useMemoBody(content: string, name: string): string {
  const start = content.indexOf(`const ${name} = useMemo(`);
  expect(start, `${name} is no longer a useMemo`).toBeGreaterThan(-1);
  // Balance-match the parens rather than hunting for a `],` token: a
  // single-line dependency array with no trailing comma has no such token,
  // and the memo body itself can contain commas and brackets.
  const open = content.indexOf("(", start);
  expect(open, `${name} has no useMemo call`).toBeGreaterThan(start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < content.length; i += 1) {
    if (content[i] === "(") depth += 1;
    else if (content[i] === ")") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, `${name}'s useMemo is not closed`).toBeGreaterThan(open);
  return content.slice(start, end + 1);
}

describe("SprintPlanningPage memoises the burndown inputs", () => {
  const content = source();

  it("derives the active sprint's tasks in a useMemo", () => {
    const body = useMemoBody(content, "activeTasks");
    // `tasks` is the whole list; a task moving into or out of the active
    // sprint has to re-derive. Missing either dep is a correctness bug.
    expect(body, "activeTasks must depend on tasks").toContain("tasks");
    expect(body, "activeTasks must depend on the active sprint id").toContain(
      "active?.id",
    );
    // The filter itself must still be there -- the memo wraps it, it does not
    // replace it.
    expect(body).toContain("t.sprintId === active.id");
    // The un-memoised form this replaced.
    expect(content).not.toMatch(/tasks=\{tasks\.filter\(/);
  });

  it("hands the chart a stable empty array when no sprint is active", () => {
    // `active` is undefined while the sprints read is loading and after a
    // workspace with no active sprint. The memo returns EMPTY_TASKS then; if
    // that were an inline `[]` it would be a fresh array per render.
    expect(content, "the empty fallback must be a module-level constant").toMatch(
      /const EMPTY_TASKS: TaskItemResponse\[\] = \[\];/,
    );
    const body = useMemoBody(content, "activeTasks");
    expect(body).toContain("EMPTY_TASKS");
    // The render site must pass the memo, not a filter.
    expect(content).toMatch(/tasks=\{activeTasks\}/);
  });

  it("memoises the progress counts instead of two inline filters", () => {
    // SprintProgress takes two numbers; computing them with `tasks.filter(...)`
    // at the render site scanned the list twice per render for values that
    // change only when the tasks do.
    const body = useMemoBody(content, "activeProgress");
    expect(body, "activeProgress must depend on activeTasks").toContain(
      "activeTasks",
    );
    expect(body).toContain("Done");
    // The un-memoised form this replaced, at the render site.
    expect(content).not.toMatch(
      /total=\{\s*tasks\.filter\(\(t\) => t\.sprintId === active\.id\)\.length\s*\}/,
    );
    expect(content).toMatch(/total=\{activeProgress\.total\}/);
    expect(content).toMatch(/completed=\{activeProgress\.completed\}/);
  });
});
