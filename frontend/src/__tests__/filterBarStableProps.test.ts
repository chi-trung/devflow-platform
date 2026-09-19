import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// FilterBar is memoised (see filterBarMemo.test.tsx for the render-count
// proof), so every prop reaching it must be stable or the memo releases for
// nothing. BoardPage is FilterBar's only call site, so this guards the whole
// surface.
//
// These are greppable invariants rather than render counts: an inline object
// literal, an inline arrow or an inline `?? []` at the render site is a fresh
// identity every render, and that is invisible to any behaviour test.

const PAGES = join(__dirname, "..", "pages");
const COMPONENTS = join(__dirname, "..", "components");

function page(): string {
  return readFileSync(join(PAGES, "BoardPage.tsx"), "utf8");
}

describe("BoardPage hands FilterBar stable props", () => {
  const content = page();

  it("is the only place FilterBar is rendered", () => {
    const sites = content.match(/<FilterBar\b/g);
    expect(sites, "FilterBar render sites").toHaveLength(1);
  });

  it("exports FilterBar as a memo", () => {
    // The pair is both halves: a stable `current` object into an un-memoised
    // FilterBar is dead weight (the body re-runs regardless of prop identity).
    const bar = readFileSync(join(COMPONENTS, "board", "FilterBar.tsx"), "utf8");
    expect(bar).toMatch(/export const FilterBar = memo\(function FilterBar\(/);
  });

  it("does not hand FilterBar an inline object for `current`", () => {
    // Nine filter fields read from nine useState hooks: an inline literal is a
    // fresh object every render, so the memo holds for no keystroke.
    expect(content).not.toMatch(/current=\{\{/);
    expect(content).toMatch(/current=\{filterState\}/);
    const start = content.indexOf("const filterState = ");
    expect(start, "filterState is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 60),
      "filterState must be a useMemo",
    ).toContain("useMemo");
  });

  it("does not hand FilterBar an inline arrow for `onChange`", () => {
    expect(content).not.toMatch(/onChange=\{\(patch\) =>/);
    expect(content).toMatch(/onChange=\{handleFilterChange\}/);
    const start = content.indexOf("const handleFilterChange = ");
    expect(start, "handleFilterChange is defined").toBeGreaterThan(-1);
    expect(
      content.slice(start, start + 70),
      "handleFilterChange must be a useCallback",
    ).toContain("useCallback");
  });

  it("uses the module-level empty-array constants, not inline literals", () => {
    // A fresh `?? []` per render defeats the memo for the whole loading
    // window, while the members/labels fetches are still null.
    const start = content.indexOf("<FilterBar");
    expect(start, "the FilterBar render site moved").toBeGreaterThan(-1);
    const site = content.slice(start, start + 420);
    expect(site).not.toMatch(/\?\? \[\]/);
    expect(site).toMatch(/members=\{members \?\? EMPTY_MEMBERS\}/);
    expect(site).toMatch(/labels=\{labels \?\? EMPTY_LABELS\}/);
  });

  it("the other FilterBar props are stable by construction", () => {
    // Not every prop needs its own guard:
    //   projectId/membersFailed/labelsFailed/blockedUnknown: strings and
    //     booleans, compared by value in the default shallow compare, so
    //     identity does not matter.
    //   onRetryMembers/onRetryLabels: `reload` values from useApi, which are
    //     useCallback identities and therefore stable across renders.
    const start = content.indexOf("<FilterBar");
    const site = content.slice(start, start + 500);
    expect(site).toMatch(/projectId=\{projectId\}/);
    expect(site).toMatch(/onRetryMembers=\{reloadMembers\}/);
    expect(site).toMatch(/onRetryLabels=\{reloadLabels\}/);
  });
});
