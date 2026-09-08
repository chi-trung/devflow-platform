// Changelog entry text lives in src/data/changelog.ts (not the i18n catalogs),
// so this test carries the bilingual-parity load for it: every string must
// exist in BOTH locales, versions must be unique and newest-first.
import { describe, it, expect } from "vitest";
import {
  CHANGELOG_ENTRIES,
  ROADMAP_ITEMS,
  isValidChangelogData,
} from "../data/changelog";

function walkLocalized(value: unknown, path: string, out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkLocalized(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.en === "string" && typeof obj.vi === "string") {
      if (obj.en.trim() === "" || obj.vi.trim() === "") out.push(path);
      return;
    }
    for (const [k, v] of Object.entries(obj)) walkLocalized(v, `${path}.${k}`, out);
  }
}

describe("changelog data", () => {
  it("every localized string has non-empty en and vi forms", () => {
    const empty: string[] = [];
    walkLocalized(CHANGELOG_ENTRIES, "entries", empty);
    walkLocalized(ROADMAP_ITEMS, "roadmap", empty);
    expect(empty).toEqual([]);
  });

  it("versions are unique and sorted newest-first with valid dates", () => {
    const versions = CHANGELOG_ENTRIES.map((e) => e.version);
    expect(new Set(versions).size).toBe(versions.length);

    for (let i = 0; i < CHANGELOG_ENTRIES.length; i++) {
      const date = new Date(CHANGELOG_ENTRIES[i].date);
      expect(Number.isNaN(date.getTime()), CHANGELOG_ENTRIES[i].date).toBe(false);
      if (i > 0) {
        expect(
          new Date(CHANGELOG_ENTRIES[i - 1].date).getTime(),
        ).toBeGreaterThanOrEqual(date.getTime());
      }
    }
  });

  it("isValidChangelogData accepts the shipped data", () => {
    expect(isValidChangelogData()).toBe(true);
  });
});
