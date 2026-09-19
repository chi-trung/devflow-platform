import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TaskDetailPanel is mounted as a modal overlay while BoardPage re-renders on
// every keystroke. Before the memo it re-ran its full body per keystroke --
// an 1100-line component with ~33 hooks, several effects, comment/attachment
// lists, and a DoD split + regex filter on every render. Memoising it only
// holds if every prop reaching it is stable, so the fix is a PAIR:
//  1. memo on the component;
//  2. stable identity for every prop the call site passes.
//
// These guards lock the call-site half, which is the half that silently
// regresses: a future edit rewriting `sprints={panelSprints}` back to an
// inline `.filter()` looks harmless and compiles fine, but defeats the memo
// on every keystroke.

const PAGES = join(__dirname, "..", "pages");

function source(): string {
  return readFileSync(join(PAGES, "BoardPage.tsx"), "utf8");
}

/** The JSX element for the panel, plus its props. */
function panelCallSite(content: string): string {
  const start = content.indexOf("<TaskDetailPanel");
  expect(start, "the TaskDetailPanel call site moved").toBeGreaterThan(-1);
  const end = content.indexOf("/>", start);
  expect(end, "the TaskDetailPanel call site is not closed").toBeGreaterThan(start);
  return content.slice(start, end + 2);
}

describe("BoardPage hands TaskDetailPanel stable props", () => {
  const content = source();

  it("memoises the sprint list instead of filtering at the render site", () => {
    // `(sprints ?? []).filter(...)` in the JSX is a fresh array every render,
    // which releases the memo. The memo must live above the call site.
    const site = panelCallSite(content);
    expect(site, "sprints must come from a memoised value").toMatch(
      /sprints=\{panelSprints\}/,
    );
    expect(site).not.toMatch(/sprints=\{\(sprints \?\? \[\]\)\.filter\(/);

    // The memo itself, and its dependency. A missing dep would silently stop
    // updating the dropdown when sprints load.
    const memoStart = content.indexOf("const panelSprints = useMemo(");
    expect(memoStart, "panelSprints is no longer a useMemo").toBeGreaterThan(-1);
    // Balance-match the parens so the deps array is included regardless of
    // line shape (the `],`-token form breaks on single-line arrays).
    const open = content.indexOf("(", memoStart);
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
    expect(end, "panelSprints' useMemo is not closed").toBeGreaterThan(open);
    const body = content.slice(memoStart, end + 1);
    expect(body, "panelSprints must depend on sprints").toContain("sprints");
    expect(body).toContain("Completed");
  });

  it("hands the panel stable empty members and no inline arrows", () => {
    // `members ?? []` at the call site is a fresh array while the roster
    // loads, defeating the memo for the whole loading window.
    const site = panelCallSite(content);
    expect(site, "members must fall back to the module-level constant").toMatch(
      /members=\{members \?\? EMPTY_MEMBERS\}/,
    );
    // Inline arrows are a fresh function identity every render.
    expect(site).not.toMatch(/onClose=\{\(\) =>/);
    expect(site).not.toMatch(/onTaskChanged=\{\(\) =>/);
    expect(site).toMatch(/onClose=\{closeDetailPanel\}/);
    expect(site).toMatch(/onTaskChanged=\{handleTaskChanged\}/);
  });

  it("keeps the panel handlers in useCallback", () => {
    // The named handlers the call site references must themselves be
    // stable, or the two guards above pass while the memo still releases.
    for (const name of ["closeDetailPanel", "handleTaskChanged"]) {
      const decl = content.indexOf(`const ${name} = useCallback(`);
      expect(decl, `${name} must be a useCallback`).toBeGreaterThan(-1);
    }
  });
});
