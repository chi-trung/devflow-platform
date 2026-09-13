import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Regression for WCAG 1.3.1 (info and relationships): the visual list
// structure must survive to the accessibility tree. Tailwind v4's preflight
// resets list-style to none on ul/ol, and every list in this app also sets
// display:flex/grid on the element itself — together these make
// Safari/VoiceOver strip the "list, N items" announcement, flattening
// activity feeds, label rows and notification lists into an undifferentiated
// stream of links. The repo's fix is an explicit role="list" on the element.
// (Adding it costs nothing in other AT: it re-asserts the implicit role.)
//
// Legitimate exemptions, matched on the element's own opening tag:
//  * role="..." already present — a composite widget (CommandPalette's
//    role="listbox" results) owns its semantics;
//  * list-disc / list-decimal in className — the author restored native
//    bullets, so the native list role survives without help
//    (ImportTasksModal error list, AiPlanPanel step list).

const SRC = join(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

const files = [...walk(join(SRC, "pages")), ...walk(join(SRC, "components"))];

const LIST_OPEN = /<(ul|ol)\b((?:(?!>)[\s\S])*)>/g;

describe("lists stay lists for assistive tech (WCAG 1.3.1)", () => {
  const offenders: string[] = [];

  for (const file of files) {
    const rel = relative(SRC, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");

    for (const match of content.matchAll(LIST_OPEN)) {
      const [, tag, attrs] = match;
      if (/\brole=/.test(attrs)) continue;
      if (/list-(disc|decimal)/.test(attrs)) continue;

      const upto = content.slice(0, match.index ?? 0).split("\n").length;
      offenders.push(
        `${rel}:${upto} <${tag}> has preflight-stripped list semantics and no role="list"`,
      );
    }
  }

  it("every ul/ol either restores native bullets, owns a widget role, or carries role=list", () => {
    expect(offenders).toEqual([]);
  });
});
