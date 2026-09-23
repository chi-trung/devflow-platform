import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// TaskDetailPanel is mounted inside TaskDetailOverlay while other state on
// the board (members/sprints still resolving, Escape nav) can re-render the
// shell. Before the memo it re-ran its full body per keystroke -- an
// 1100-line component with ~33 hooks, several effects, comment/attachment
// lists, and a DoD split + regex filter on every render. Memoising it only
// holds if every prop reaching it is stable, so the fix is a PAIR:
//  1. memo on the component;
//  2. stable identity for every prop the call site passes.
//
// These guards lock the call-site half, which is the half that silently
// regresses: a future edit rewriting `sprints={panelSprints}` back to an
// inline `.filter()` looks harmless and compiles fine, but defeats the memo
// on every keystroke.
//
// The call site moved from TaskDetailPage (full route) to TaskDetailOverlay
// (in-page modal over the board) — same contract, new file.

const HERE = __dirname;

function source(): string {
  return readFileSync(
    join(HERE, "..", "components", "board", "TaskDetailOverlay.tsx"),
    "utf8",
  );
}

/** The JSX element for the panel, plus its props. */
function panelCallSite(content: string): string {
  const start = content.indexOf("<TaskDetailPanel");
  expect(start, "the TaskDetailPanel call site moved").toBeGreaterThan(-1);
  const end = content.indexOf("/>", start);
  expect(end, "the TaskDetailPanel call site is not closed").toBeGreaterThan(start);
  return content.slice(start, end + 2);
}

describe("TaskDetailOverlay hands TaskDetailPanel stable props", () => {
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
    expect(site).toMatch(/onClose=\{onClose\}/);
    expect(site).toMatch(/onTaskChanged=\{handleTaskChanged\}/);
  });

  it("keeps the panel handlers in useCallback", () => {
    // The named handlers the call site references must themselves be
    // stable, or the two guards above pass while the memo still releases.
    // onClose is a prop from BoardPage — BoardPage must hand it over as a
    // useCallback (closeTask there), not an inline arrow at this mount.
    const decl = content.indexOf("const handleTaskChanged = useCallback(");
    expect(decl, "handleTaskChanged must be a useCallback").toBeGreaterThan(-1);
  });
});

describe("BoardPage hands the overlay a stable close", () => {
  const board = readFileSync(join(HERE, "..", "pages", "BoardPage.tsx"), "utf8");

  it("wires onClose to a named useCallback, not an inline arrow", () => {
    const start = board.indexOf("<TaskDetailOverlay");
    expect(start, "BoardPage no longer mounts TaskDetailOverlay").toBeGreaterThan(-1);
    const end = board.indexOf("/>", start);
    const site = board.slice(start, end + 2);
    expect(site).toMatch(/onClose=\{closeTask\}/);
    expect(site).not.toMatch(/onClose=\{\(\) =>/);
    expect(board).toContain("const closeTask = useCallback(");
    expect(board).toContain("const handleOverlayTaskChanged = useCallback(");
    expect(site).toMatch(/onTaskChanged=\{handleOverlayTaskChanged\}/);
  });
});
