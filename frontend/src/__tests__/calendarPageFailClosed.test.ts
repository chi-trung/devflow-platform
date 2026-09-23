import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Calendar is not a CRUD list, but it owns the same fail-closed contract as
// the wave-2..12 pages: unknown ≠ empty, and every load error ships a retry.

const page = readFileSync(
  join(__dirname, "..", "pages", "CalendarPage.tsx"),
  "utf8",
);

describe("CalendarPage fail-closed", () => {
  it("gates EmptyState behind a successful load", () => {
    expect(page).toContain("error === null && calendar !== null");
    expect(page).toContain('id="calendar-load-error"');
    // EmptyState must not fire on error alone.
    expect(page).not.toMatch(/items\.length === 0 \? \(\s*<EmptyState/);
  });

  it("load errors come with a retry wired to the loader", () => {
    expect(page).toMatch(/<ErrorAlert id="calendar-load-error"/);
    expect(page).toContain('t("common.retry")');
    expect(page).toMatch(/onClick=\{reload\}/);
  });

  it("error branch disables the grid (banner only when data is null)", () => {
    expect(page).toContain("showError = error !== null && calendar === null");
    expect(page).toContain("showGrid = calendar !== null");
  });
});
