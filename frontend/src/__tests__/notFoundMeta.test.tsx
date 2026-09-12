import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "../pages/NotFoundPage";

// Mock i18n like changelogPage.test.tsx (raw keys back). The assertion target
// is the side effect usePageMeta writes into <head> (document.head survives
// between tests in jsdom, so afterEach removes the tags again).
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

afterEach(() => {
  document.querySelector('meta[name="robots"]')?.remove();
  document.querySelector('link[rel="canonical"]')?.remove();
});

describe("NotFoundPage meta", () => {
  it("noindexes and canonicalizes to the origin, not the random path", () => {
    // The route can be hit as any unknown URL; use the real SPA path.
    window.history.pushState({}, "", "/this-route-does-not-exist");
    render(
      <MemoryRouter initialEntries={["/this-route-does-not-exist"]}>
        <NotFoundPage />
      </MemoryRouter>,
    );

    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute("content")).toBe("noindex,follow");

    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute("href")).toBe(window.location.origin + "/");
    window.history.pushState({}, "", "/");
  });
});
