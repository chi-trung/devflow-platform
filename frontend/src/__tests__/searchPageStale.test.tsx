import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// SearchPage's runSearch awaits a fetch and writes the result into state
// without checking that the result is still the one the user is waiting for.
// The saved-search dropdown is the one control not disabled while a search
// loads, so selecting another saved search puts two requests in flight: if the
// older one settles last, it replaces the results the user is looking at along
// with the page counter (or, while nothing has loaded, swaps skeletons for an
// error nobody asked for).

// react-i18next returns one stable `t` for the life of the component; a fresh
// arrow every render would re-run every effect keyed on it and bury the race.
const stableT = vi.hoisted(() => (key: string) => key);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// /members returns a flat array; /projects returns a PagedResult. Handing the
// same shape to both makes members.map throw and unmounts the whole tree, which
// in a jsdom render looks identical to the race being absent.
vi.mock("../lib/api", () => ({
  api: vi.fn().mockImplementation((url: string) =>
    typeof url === "string" && url.includes("/members")
      ? Promise.resolve([])
      : Promise.resolve([{ id: "p1", key: "PRJ", name: "Proj" }]),
  ),
  searchWorkspace: vi.fn(),
  getSavedSearches: vi.fn().mockResolvedValue([]),
  pagedItems: (raw: unknown) => (Array.isArray(raw) ? raw : []),
}));

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SearchPage } from "../pages/SearchPage";
import { searchWorkspace, getSavedSearches } from "../lib/api";

interface FakeTask {
  id: string;
  title: string;
  projectKey: string;
  status: string;
}

interface FakeResult {
  tasks: FakeTask[];
  projects: never[];
  epics: never[];
  labels: never[];
  users: never[];
  comments: never[];
  customFields: never[];
  pagination: {
    totalTasks: number;
    totalProjects: number;
    totalEpics: number;
    totalLabels: number;
    totalUsers: number;
    totalComments: number;
  };
}

function resultWith(ids: string[], totalTasks: number): FakeResult {
  return {
    tasks: ids.map((id) => ({
      id,
      title: `task-${id}`,
      projectKey: "PRJ",
      status: "Ready",
    })),
    projects: [],
    epics: [],
    labels: [],
    users: [],
    comments: [],
    customFields: [],
    pagination: {
      totalTasks,
      totalProjects: 0,
      totalEpics: 0,
      totalLabels: 0,
      totalUsers: 0,
      totalComments: 0,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws-1/search"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/search" element={<SearchPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const calls = () =>
  (searchWorkspace as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
const queryOf = (call: unknown[]) => call[1] as string;

describe("SearchPage ignores stale search responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a late response from a previous search does not replace the current one", async () => {
    // Two saved searches, each pending, so the second selection races the first.
    (searchWorkspace as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => deferred<FakeResult>().promise,
    );
    const first = deferred<FakeResult>();
    const second = deferred<FakeResult>();
    let n = 0;
    (searchWorkspace as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      ++n === 1 ? first.promise : second.promise,
    );
    (getSavedSearches as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", name: "Saved One", query: "deploy", filtersJson: "{}" },
      { id: "s2", name: "Saved Two", query: "ship", filtersJson: "{}" },
    ]);

    renderPage();
    const savedSelect = await screen.findByRole("combobox", {
      name: "search.applySavedSearch",
    });
    await waitFor(() => expect(savedSelect.children.length).toBeGreaterThan(2));

    fireEvent.change(savedSelect, { target: { value: "s1" } });
    await waitFor(() => expect(calls().length).toBe(1));
    fireEvent.change(savedSelect, { target: { value: "s2" } });
    await waitFor(() => expect(calls().length).toBe(2));

    // The second search lands first, then the older response arrives last.
    second.resolve(resultWith(["s2a", "s2b"], 60));
    await waitFor(() => expect(screen.getByText("task-s2a")).toBeInTheDocument());

    first.resolve(resultWith(["s1a", "s1b"], 60));
    await waitFor(() =>
      expect(screen.queryByText("task-s1a")).not.toBeInTheDocument(),
    );

    // The list still belongs to the search the dropdown actually shows.
    expect(screen.getByText("task-s2a")).toBeInTheDocument();
    expect(screen.getByText("task-s2b")).toBeInTheDocument();
  });

  it("a late error from a previous search does not replace the current results", async () => {
    const first = deferred<FakeResult>();
    const second = deferred<FakeResult>();
    let n = 0;
    (searchWorkspace as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      ++n === 1 ? first.promise : second.promise,
    );
    (getSavedSearches as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", name: "Saved One", query: "deploy", filtersJson: "{}" },
      { id: "s2", name: "Saved Two", query: "ship", filtersJson: "{}" },
    ]);

    renderPage();
    const savedSelect = await screen.findByRole("combobox", {
      name: "search.applySavedSearch",
    });
    await waitFor(() => expect(savedSelect.children.length).toBeGreaterThan(2));

    fireEvent.change(savedSelect, { target: { value: "s1" } });
    await waitFor(() => expect(calls().length).toBe(1));
    fireEvent.change(savedSelect, { target: { value: "s2" } });
    await waitFor(() => expect(calls().length).toBe(2));

    // The first search fails while the second is still loading. The unguarded
    // catch would land between the two and, with nothing loaded yet, swap the
    // skeletons for a full error card for a search already moved past.
    void first.promise.catch(() => undefined);
    first.reject(new Error("stale 500"));

    // The second response is the one the user is waiting on; it must land.
    second.resolve(resultWith(["s2a"], 60));
    await waitFor(() => expect(screen.getByText("task-s2a")).toBeInTheDocument());

    // The dead error never reached the screen.
    expect(screen.queryByText("stale 500")).not.toBeInTheDocument();
  });

  it("applies the saved search's own query, not the text left in the box", async () => {
    (searchWorkspace as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      resultWith([], 0),
    );
    (getSavedSearches as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "s1", name: "Saved One", query: "deploy", filtersJson: "{}" },
    ]);

    renderPage();
    fireEvent.change(screen.getByLabelText("search.search"), {
      target: { value: "old-term" },
    });
    fireEvent.click(screen.getByRole("button", { name: "search.search" }));
    await waitFor(() => expect(calls().length).toBe(1));

    fireEvent.change(
      await screen.findByRole("combobox", { name: "search.applySavedSearch" }),
      { target: { value: "s1" } },
    );
    await waitFor(() => expect(calls().length).toBe(2));

    // Without an override the query would read the pre-setQuery state and the
    // saved search would hunt for "old-term" instead of "deploy".
    expect(queryOf(calls()[1])).toBe("deploy");
  });
});
