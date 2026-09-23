import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Recurring list + task section own the same fail-closed contract as the
// CRUD pages: unknown ≠ empty, every load error ships a retry.

const list = readFileSync(
  join(__dirname, "..", "components", "calendar", "RecurringRulesList.tsx"),
  "utf8",
);
const section = readFileSync(
  join(__dirname, "..", "components", "calendar", "TaskRecurrenceSection.tsx"),
  "utf8",
);

describe("RecurringRulesList fail-closed", () => {
  it("gates EmptyState behind a successful empty list", () => {
    expect(list).toContain("rules !== null && rules.length === 0");
    expect(list).toContain('id="calendar-rules-load-error"');
  });

  it("load errors come with a retry wired to the loader", () => {
    expect(list).toMatch(/<ErrorAlert id="calendar-rules-load-error"/);
    expect(list).toContain('t("common.retry")');
    expect(list).toMatch(/onClick=\{load\}/);
  });
});

describe("TaskRecurrenceSection fail-closed", () => {
  it("a failed list never paints \"no rule yet\"", () => {
    expect(section).toContain("error !== null && rule === null");
    expect(section).toContain('id="task-recurrence-load-error"');
    // noneYet only appears after a successful load with no match.
    expect(section).toMatch(/rule\s*\?\s*rule\.isActive/);
  });

  it("load errors come with a retry wired to the loader", () => {
    expect(section).toMatch(/<ErrorAlert id="task-recurrence-load-error"/);
    expect(section).toContain('t("common.retry")');
    expect(section).toMatch(/onClick=\{load\}/);
  });
});
