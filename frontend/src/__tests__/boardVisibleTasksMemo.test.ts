import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// BoardPage runs fourteen filters over the ENTIRE task list to derive
// `visibleTasks`, which then feeds the page slice, the Ctrl+A shortcut and
// every column's `tasks` prop. Before it was memoised, that chain re-ran on
// every render — opening a drawer or pressing a selection key rebuilt all
// fourteen passes and handed every Column a brand-new array, defeating
// Column's own `tasks.length` effects and re-running its windowing.
//
// Two invariants, greppable in the source:
//  1. `visibleTasks` is wrapped in useMemo with a dependency list naming the
//     filters (an empty or stale list is a correctness bug — a filter change
//     would silently not re-filter).
//  2. every value in that dependency list is itself stable across renders
//     that don't change it. `parsedSearch` was a fresh object every render
//     (`parseSearchQuery(search)` called unconditionally), which made the
//     memo cache useless even with a correct dependency list; it must be
//     memoised on `search`.

const PAGES = join(__dirname, "..", "pages");

function source(): string {
  return readFileSync(join(PAGES, "BoardPage.tsx"), "utf8");
}

/** The body of `const visibleTasks = useMemo(() => ..., [deps]);`. */
function useMemoBody(content: string, name: string): string {
  const start = content.indexOf(`const ${name} = useMemo(`);
  expect(start, `${name} is no longer a useMemo`).toBeGreaterThan(-1);
  // Close the dependency array, which ends the useMemo call.
  const depsStart = content.indexOf("],", start);
  expect(depsStart, `${name}'s dependency array was not found`).toBeGreaterThan(start);
  const end = content.indexOf(");", depsStart);
  expect(end).toBeGreaterThan(depsStart);
  return content.slice(start, end + 2);
}

describe("BoardPage memoises the fourteen-filter chain", () => {
  const content = source();

  it("wraps visibleTasks in useMemo with a real dependency list", () => {
    const body = useMemoBody(content, "visibleTasks");
    // Every filter input the chain reads must appear, or a filter change can
    // be dropped from the visible list.
    for (const dep of [
      "tasks",
      "sprintFilter",
      "priorityFilter",
      "assigneeFilter",
      "dueFrom",
      "dueTo",
      "blockedOnly",
      "blockedTaskIds",
      "labelFilter",
      "operatorLabelIds",
      "prFilter",
      "parsedSearch",
      "operatorAssigneeId",
    ]) {
      expect(body, `visibleTasks depends on ${dep}`).toContain(dep);
    }
    // All fourteen filters are still there — the memo must wrap the chain,
    // not replace a subset of it.
    expect(body.match(/\.filter\(/g), "filter count changed").toHaveLength(14);
  });

  it("memoises parsedSearch on search (a fresh object defeats the memo)", () => {
    const body = useMemoBody(content, "parsedSearch");
    expect(body, "parsedSearch must depend on search").toContain("search");
    // The un-memoised form this replaced — it would have made the
    // visibleTasks dependency list unstable on every render.
    expect(content).not.toMatch(/const parsedSearch = parseSearchQuery\(search\);/);
  });

  it("blockedTaskIds is memoised, so the dependency is stable", () => {
    const body = useMemoBody(content, "blockedTaskIds");
    expect(body).toContain("depGraph");
  });

  it("memoises pagedTasks and partitions once per status, not per render", () => {
    // Column's `shown` windowing and swimlane partition both key on the
    // `tasks` prop by identity. An inline `pagedTasks.filter(...)` at the
    // render site is a fresh array every render, which invalidates both of
    // Column's memos on every keystroke and re-slices/re-partitions every
    // column for nothing.
    const paged = useMemoBody(content, "pagedTasks");
    expect(paged, "pagedTasks must depend on visibleTasks").toContain("visibleTasks");
    expect(paged, "pagedTasks must depend on safePage").toContain("safePage");

    const byStatus = useMemoBody(content, "tasksByStatus");
    expect(byStatus, "tasksByStatus must depend on pagedTasks").toContain("pagedTasks");
    // The old form: a per-column inline filter at the render site.
    expect(content).not.toMatch(/tasks=\{pagedTasks\.filter\(/);
  });

  it("hands Column a stable empty array for a status with no tasks", () => {
    // Every column gets a `tasks` prop every render. A missing-map lookup
    // returning an inline `[]` would be a fresh array per render and would
    // defeat Column's memos exactly like the inline filter did.
    expect(content, "the empty-array fallback must be a module-level constant")
      .toMatch(/EMPTY_TASKS/);
    expect(content).toMatch(/tasks=\{tasksByStatus\.get\(status\) \?\? EMPTY_TASKS\}/);
  });

  it("does not hand TaskCard a fresh empty array for members or epics", () => {
    // TaskCard is memoised and takes `members` (and, through Column, `epics`)
    // as props. `data ?? []` creates a new array every render while the data
    // is loading, which defeats that memo for the whole loading window —
    // exactly the bug the empty-tasks constant exists for. Scoped to the
    // Column render site: `members ?? []` elsewhere (presence, bulk-assign,
    // the members strip) feeds event handlers and JSX maps, not memoised
    // props, so the identity does not matter there.
    const colStart = content.indexOf("tasks={tasksByStatus.get(status) ?? EMPTY_TASKS}");
    expect(colStart, "the Column render site moved").toBeGreaterThan(-1);
    const site = content.slice(colStart, colStart + 400);
    expect(site).not.toMatch(/\?\? \[\]/);
    expect(site).toMatch(/members=\{members \?\? EMPTY_MEMBERS\}/);
    expect(site).toMatch(/epics=\{epics \?\? EMPTY_EPICS\}/);
  });
});
