import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  areCharacterShortcutsEnabled,
  setCharacterShortcutsEnabled,
} from "../lib/keyboardShortcuts";

// Regression for WCAG 2.1.4 (Character Key Shortcuts, Level A): every action
// bound to a bare printable key must be turn-off-able. The board's handler
// binds n, /, f and ?, and the lib's preference is the turn-off. Two halves
// are locked here: the storage contract, and the static invariant that every
// single-character `case` in the board keydown switch consults the gate
// (a future `case "b":` added without it must fail this test).

describe("character shortcut preference (WCAG 2.1.4)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to enabled and persists only the disabled state", () => {
    expect(areCharacterShortcutsEnabled()).toBe(true);
    setCharacterShortcutsEnabled(false);
    expect(areCharacterShortcutsEnabled()).toBe(false);
    setCharacterShortcutsEnabled(true);
    expect(areCharacterShortcutsEnabled()).toBe(true);
    expect(localStorage.getItem("devflow.boardShortcuts")).toBeNull();
  });
});

describe("board keydown switch respects the gate (WCAG 2.1.4)", () => {
  const source = readFileSync(
    join(__dirname, "..", "pages", "BoardPage.tsx"),
    "utf8",
  );

  it("every bare-character case checks areCharacterShortcutsEnabled", () => {
    const switchBlock = source.match(/switch \(event\.key\) \{([\s\S]*?)\n {6}\}/);
    expect(switchBlock, "board keydown switch not found").not.toBeNull();
    const body = switchBlock![1];

    const ungated: string[] = [];
    for (const label of body.matchAll(/case "([^"]+)"/g)) {
      // Exempt per the criterion itself: non-character keys (Escape,
      // Delete, arrows) are not single printable characters.
      if (label[1].length !== 1) continue;
      // Fall-through cases share the body of the next break; measure the
      // whole span this case dispatches into, not just its label line.
      const start = (label.index ?? 0) + label[0].length;
      const end = body.indexOf("break;", start);
      const chunk = body.slice(start, end === -1 ? body.length : end);
      if (!chunk.includes("areCharacterShortcutsEnabled()")) {
        ungated.push(label[1]);
      }
    }
    expect(ungated, `cases bound to characters without a turn-off`).toEqual([]);
    // Guard against the scan silently matching nothing: the shipped binding
    // set must still be present.
    expect(body).toContain('case "n"');
    expect(body).toContain('case "?"');
  });
});
