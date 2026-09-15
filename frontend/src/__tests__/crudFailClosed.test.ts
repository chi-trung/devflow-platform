import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression for the fail-closed convention (waves 2-12): a CRUD page whose
// list fetch failed must never render "nothing here yet" — unknown is not
// empty, and the EmptyState's create action pushes the user to invent data
// where the truth is "we couldn't look". Two invariants, greppable per page:
//  1. every `x.length === 0` branch that renders an EmptyState carries an
//     `&& !error` guard on the same condition;
//  2. load errors ship a `common.retry` Button wired to the loader — a
//     banner alone is a dead end (wave-10's NotificationsPage shape).
// WebhooksPage is checked twice: its webhook list AND its dead-letter section
// (dlqError) are independent fetches with the same failure modes.

const PAGES = join(__dirname, "..", "pages");

const CRUD_PAGES = [
  "LabelsPage",
  "TemplatesPage",
  "SavedSearchesPage",
  "ActivitiesPage",
  "CustomFieldsPage",
  "MilestonesPage",
  "KnowledgePage",
  "WebhooksPage",
];

function source(page: string): string {
  return readFileSync(join(PAGES, `${page}.tsx`), "utf8");
}

describe("CRUD pages fail closed on load errors", () => {
  for (const page of CRUD_PAGES) {
    it(`${page}: an EmptyState is never rendered for a failed load`, () => {
      const content = source(page);
      const offenders: string[] = [];
      for (const m of content.matchAll(/(\w+)\.length === 0 \? \(/g)) {
        const tail = content.slice(m.index!, m.index! + 300);
        if (tail.includes("<EmptyState")) offenders.push(m[0]);
      }
      expect(offenders, `${page} calls an empty list "empty" after an error`).toEqual([]);
    });

    it(`${page}: load errors come with a retry, not a dead-end banner`, () => {
      const content = source(page);
      expect(content, `${page} lost its ErrorAlert id`).toMatch(/<ErrorAlert id="[^"]*"/);
      const retryButtons = content.match(/t\("common\.retry"\)/g) ?? [];
      expect(retryButtons.length, `${page} shows load errors without a retry`).toBeGreaterThan(0);
      expect(content, `${page} retry not wired to a loader`).toMatch(/onClick=\{load\w+\}/);
    });
  }

  it("WebhooksPage: the dead-letter section gates its own empty state", () => {
    const content = source("WebhooksPage");
    expect(content).toContain("deadLetters.length === 0 && !dlqError");
    expect(content).toMatch(/<ErrorAlert id="webhooks-dlq-error"/);
  });
});
