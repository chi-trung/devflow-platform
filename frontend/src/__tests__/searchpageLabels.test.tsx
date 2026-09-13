import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { api } from "../lib/api";
import { SearchPage } from "../pages/SearchPage";

// Regression: before the gate, the labels useApi ran on mount with the
// empty-string project placeholder and built
// /workspaces/{ws}/projects//labels, a 404 on every visit to the search
// page. The fetcher must stay quiet until a real project id resolves,
// then fire exactly once with it.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="appshell">{children}</div>
  ),
}));

// Keep the real pagedItems/peekSnapshot (useApi imports them); replace only
// the network entry points so calls can be recorded.
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    api: vi.fn(),
    getSavedSearches: vi.fn(),
    searchWorkspace: vi.fn(),
  };
});

const mockedApi = vi.mocked(api);

function flush() {
  return new Promise((r) => setTimeout(r, 0));
}

function projectsPage(items: unknown[]) {
  return { items, totalCount: items.length };
}

beforeEach(() => {
  localStorage.clear();
  mockedApi.mockImplementation((url: string) => {
    if (url.endsWith("/members")) return Promise.resolve([]);
    if (url.endsWith("/projects")) return Promise.resolve(projectsPage([]));
    if (url.endsWith("/labels")) return Promise.resolve([]);
    return Promise.reject(new Error(`unexpected api call: ${url}`));
  });
});

afterEach(cleanup);

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws1/search"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SearchPage labels fetch", () => {
  it("never requests /projects//labels while no project id exists", async () => {
    renderSearch();
    await flush();
    await flush();

    const bad = mockedApi.mock.calls
      .map(([url]) => url)
      .filter((url) => /projects\/(\/|%2F)labels|projects\/\/labels/.test(url));
    expect(bad).toEqual([]);
    expect(screen.getByTestId("appshell")).toBeInTheDocument();
  });

  it("requests labels for the resolved project exactly once", async () => {
    mockedApi.mockImplementation((url: string) => {
      if (url.endsWith("/members")) return Promise.resolve([]);
      if (url.endsWith("/projects"))
        return Promise.resolve(projectsPage([{ id: "p1" }]));
      if (url.endsWith("/labels")) return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected api call: ${url}`));
    });

    renderSearch();
    await flush();
    await flush();
    await flush();

    const labelCalls = mockedApi.mock.calls
      .map(([url]) => url)
      .filter((url) => url.includes("/labels"));
    expect(labelCalls).toEqual(["/workspaces/ws1/projects/p1/labels"]);
  });
});
