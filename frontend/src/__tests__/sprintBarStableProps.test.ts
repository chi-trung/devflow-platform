import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// SprintBar is memoised (see sprintBarMemo.test.tsx for the render-count
// proof), so every prop reaching it must be stable or the memo releases for
// nothing. BoardPage is SprintBar's only call site, so this guards the whole
// surface.
//
// These are greppable invariants rather than render counts: an inline arrow or
// an inline object literal at the render site is a fresh identity every
// render, and that is invisible to any behaviour test.

const PAGES = join(__dirname, "..", "pages");
const COMPONENTS = join(__dirname, "..", "components");

function page(): string {
  return readFileSync(join(PAGES, "BoardPage.tsx"), "utf8");
}

describe("BoardPage hands SprintBar stable props", () => {
  const content = page();

  it("is the only place SprintBar is rendered", () => {
    const sites = content.match(/<SprintBar\b/g);
    expect(sites, "SprintBar render sites").toHaveLength(1);
  });

  it("exports SprintBar as a memo", () => {
    // The pair is both halves: a stable `onChanged` into an un-memoised
    // SprintBar is dead weight (the body re-runs regardless of prop identity).
    const bar = readFileSync(join(COMPONENTS, "board", "SprintBar.tsx"), "utf8");
    expect(bar).toMatch(/export const SprintBar = memo\(function SprintBar\(/);
  });

  it("does not hand SprintBar an inline arrow for `onChanged`", () => {
    expect(content).not.toMatch(/onChanged=\{\(\) =>/);
    expect(content).toMatch(/onChanged=\{handleSprintChanged\}/);
    const start = content.indexOf("const handleSprintChanged = ");
    expect(start, "handleSprintChanged is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 70),
      "handleSprintChanged must be a useCallback",
    ).toContain("useCallback");
  });

  it("the other SprintBar props are stable by construction", () => {
    // Not every prop needs its own guard:
    //   filter/workspaceId/projectId: strings, compared by value in the
    //     default shallow compare, so identity does not matter.
    //   canManage: a boolean.
    //   sprints: a useMemo over the raw fetch, not an inline `.filter()`.
    //   onFilterChange: a useState setter identity, stable for the page's life.
    const start = content.indexOf("<SprintBar");
    expect(start, "the SprintBar render site moved").toBeGreaterThan(-1);
    const site = content.slice(start, start + 420);
    expect(site).toMatch(/sprints=\{sprints\}/);
    expect(site).toMatch(/canManage=\{canManageSprints\}/);
    expect(site).toMatch(/onFilterChange=\{setSprintFilter\}/);
  });

  it("does not derive `sprints` inline at the render site", () => {
    // A `.filter()`/`.sort()` at the call site is a fresh array per render and
    // would release the memo even while the underlying list is unchanged.
    const start = content.indexOf("<SprintBar");
    const site = content.slice(start, start + 420);
    expect(site).not.toMatch(/\?\? \[\]/);
    expect(site).not.toMatch(/\.filter\(/);
  });

  it("the sprints value is a memo, not a per-render derivation", () => {
    const start = content.indexOf("const sprints = ");
    expect(start, "sprints is derived").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 60),
      "sprints must be a useMemo",
    ).toContain("useMemo");
  });
});
