// Marketing data files (blog posts, legal sections) carry their own en/vi
// pairs in src/data/*.ts instead of the i18n catalogs, so this test is their
// parity gate: every localized string needs both locales, blog dates must be
// real ISO dates sorted newest-first, and slugs must be unique.
import { describe, it, expect } from "vitest";
import { BLOG_POSTS, isValidBlogData } from "../data/blog";
import {
  LEGAL_UPDATED,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  isValidLegalData,
} from "../data/legal";
import {
  PRICING,
  DOCS_CARDS,
  COMMUNITY_CARDS,
  FAQS,
  isValidLandingContent,
} from "../data/landingContent";

function emptyLocalizedPaths(value: unknown, path: string, out: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => emptyLocalizedPaths(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.en === "string" && typeof obj.vi === "string") {
      if (obj.en.trim() === "" || obj.vi.trim() === "") out.push(path);
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      emptyLocalizedPaths(v, `${path}.${k}`, out);
    }
  }
}

describe("blog data", () => {
  it("every localized string has non-empty en and vi forms", () => {
    const empty: string[] = [];
    emptyLocalizedPaths(BLOG_POSTS, "posts", empty);
    expect(empty).toEqual([]);
  });

  it("dates are valid ISO and sorted newest-first; slugs are unique", () => {
    const slugs = BLOG_POSTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (let i = 0; i < BLOG_POSTS.length; i++) {
      expect(/^\d{4}-\d{2}-\d{2}$/.test(BLOG_POSTS[i].date)).toBe(true);
      expect(Number.isNaN(new Date(BLOG_POSTS[i].date).getTime())).toBe(false);
      if (i > 0) {
        expect(
          new Date(BLOG_POSTS[i - 1].date).getTime(),
        ).toBeGreaterThanOrEqual(new Date(BLOG_POSTS[i].date).getTime());
      }
    }
  });

  it("isValidBlogData accepts the shipped data", () => {
    expect(isValidBlogData()).toBe(true);
  });
});

describe("legal data", () => {
  it("every localized string has non-empty en and vi forms", () => {
    const empty: string[] = [];
    emptyLocalizedPaths(PRIVACY_SECTIONS, "privacy", empty);
    emptyLocalizedPaths(TERMS_SECTIONS, "terms", empty);
    expect(empty).toEqual([]);
  });

  it("the updated date is a valid ISO date", () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test(LEGAL_UPDATED)).toBe(true);
  });

  it("isValidLegalData accepts the shipped data", () => {
    expect(isValidLegalData()).toBe(true);
  });
});

describe("landing content data", () => {
  it("every localized string has non-empty en and vi forms", () => {
    const empty: string[] = [];
    emptyLocalizedPaths(PRICING, "pricing", empty);
    emptyLocalizedPaths(DOCS_CARDS, "docs", empty);
    emptyLocalizedPaths(COMMUNITY_CARDS, "community", empty);
    emptyLocalizedPaths(FAQS, "faqs", empty);
    expect(empty).toEqual([]);
  });

  it("card hrefs are app routes, section anchors or site.ts sentinels", () => {
    const SENTINELS = ["swagger", "github-repo", "github-issues"];
    for (const card of [...DOCS_CARDS, ...COMMUNITY_CARDS]) {
      const ok =
        card.href.startsWith("/") ||
        card.href.startsWith("#") ||
        SENTINELS.includes(card.href);
      expect(ok, card.href).toBe(true);
    }
  });

  it("isValidLandingContent accepts the shipped data", () => {
    expect(isValidLandingContent()).toBe(true);
  });
});
