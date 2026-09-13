import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Regression for WCAG 3.3.1 / 4.1.3: every error/status *message* must be
// announced. The repo's pattern is ErrorAlert (role="alert"), Field (its
// error <p> carries role="alert"), or a plain element with an explicit
// role="alert"/"status". Sweeps kept finding stragglers — ten pages with
// bare `bg-surface … text-destructive` boxes, a dozen inline
// `<p class="text-xs text-destructive">` paragraphs across two passes.
// Encode the invariant so the build fails if one comes back.
//
// What counts as announced:
//  * role="alert" | "status" | "log" on the element's own opening tag;
//  * a role="status"/"alert"/<ErrorAlert within the 3 lines above (the
//    message is inside an announced container);
//  * a comment containing "a11y-ok" within the 2 lines above, for bulk
//    list content that is read in the normal flow (each row is not a
//    status message — see the DLQ rows on WebhooksPage).
// Only <div>/<p> are checked; destructive-colored <span>s are badges and
// indicators whose meaning is carried by their neighbors, and
// hover:/focus:/group-hover: variants never match the exact-token test.

const SRC = join(__dirname, "..");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules" || entry.startsWith(".")) return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".tsx") ? [full] : [];
  });
}

const files = [...walk(join(SRC, "pages")), ...walk(join(SRC, "components"))];

const BARE_BOX = /className="[^"]*bg-surface[^"]*p-4[^"]*text-destructive/;
const OPEN_TAG = /<(div|p)\b([^>]*)>/g;

describe("errors are announced (WCAG 3.3.1 / 4.1.3)", () => {
  const offenders: string[] = [];

  for (const file of files) {
    const rel = relative(SRC, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");

    if (BARE_BOX.test(content)) {
      offenders.push(`${rel}: bare error box — render <ErrorAlert message={...} />`);
    }

    for (const match of content.matchAll(OPEN_TAG)) {
      const [, tag, attrs] = match;
      if (!/class(?:Name)?=/.test(attrs)) continue;
      // Only the exact token, not hover:text-destructive & friends.
      const classValues = [...attrs.matchAll(/class(?:Name)?=(?:"([^"]*)"|\{([^{}]*)\})/g)]
        .map((m) => `${m[1] ?? ""} ${m[2] ?? ""}`)
        .join(" ");
      const tokens = classValues.split(/[\s"'`;`{}?:&|()[\]]+/);
      if (!tokens.some((t) => /^text-destructive(\/\d+)?$/.test(t))) continue;
      if (/role=["'](alert|status|log)["']/.test(attrs)) continue;

      const line = lines.slice(0, content.slice(0, match.index ?? 0).split("\n").length);
      const above = line.slice(-4).join(" ");
      if (/role=["'](alert|status)["']|<ErrorAlert/.test(above)) continue;
      if (/a11y-ok/.test(line.slice(-3).join(" "))) continue;

      offenders.push(
        `${rel}:${line.length} <${tag}> renders destructive text with no role="alert|status|log"`,
      );
    }
  }

  it("no page or component renders an unannounced error/status message", () => {
    expect(offenders).toEqual([]);
  });
});
