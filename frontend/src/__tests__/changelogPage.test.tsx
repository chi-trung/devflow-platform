import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChangelogPage } from "../pages/ChangelogPage";
import { CHANGELOG_ENTRIES } from "../data/changelog";

// The page makes no API calls; mock i18n (raw keys) and follow the
// appshell.test.tsx mock style. Data-module strings render verbatim, so
// assertions go against real changelog values.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/changelog"]}>
      <ChangelogPage />
    </MemoryRouter>,
  );
}

describe("ChangelogPage", () => {
  it("renders shipped + roadmap sections without auth", () => {
    renderPage();
    expect(screen.getByText("changelog.shippedTitle")).toBeInTheDocument();
    expect(screen.getByText("changelog.roadmapTitle")).toBeInTheDocument();
  });

  it("renders one version chip per changelog entry", () => {
    renderPage();
    for (const entry of CHANGELOG_ENTRIES) {
      expect(screen.getByText(entry.version)).toBeInTheDocument();
    }
  });

  it("renders roadmap item titles from the data module", () => {
    renderPage();
    expect(screen.getByText(CHANGELOG_ENTRIES[0].title.en)).toBeInTheDocument();
  });
});
