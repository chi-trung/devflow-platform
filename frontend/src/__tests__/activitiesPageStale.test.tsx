import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

// ActivitiesPage writes list state straight from a response, with no check that
// the response is still the one the user is waiting for. Changing the actor
// filter twice in a row puts two requests in flight at once; if the older one
// resolves last, it silently replaces the list the user is looking at (or, on
// failure, wipes it for an error nobody asked for). Only the most recent
// request may write state.

// react-i18next returns one stable `t` for the life of the component. A fresh
// arrow every render would give ActivitiesPage a new loadActivities each time,
// re-firing the load effect and burying the real race under a refetch storm.
const stableT = vi.hoisted(() => (key: string) => key);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../lib/api", () => ({
  api: vi.fn().mockResolvedValue([]),
  getActivities: vi.fn(),
}));

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ActivitiesPage } from "../pages/ActivitiesPage";
import { api, getActivities } from "../lib/api";

interface FakeActivity {
  id: string;
  actorName: string;
  action: string;
  target: string;
  createdAtUtc: string;
}

function pageOf(ids: string[], n: number, totalCount = 60, totalPages = 3) {
  const items: FakeActivity[] = ids.map((id) => ({
    id,
    actorName: `user-${id}`,
    action: "created task",
    target: `task-${id}`,
    createdAtUtc: "2026-09-18T00:00:00Z",
  }));
  return { items, totalCount, page: n, pageSize: 25, totalPages };
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
    <MemoryRouter initialEntries={["/workspaces/ws-1/projects/prj-1/activities"]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/projects/:projectId/activities"
          element={<ActivitiesPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const calls = () =>
  (getActivities as unknown as ReturnType<typeof vi.fn>).mock.calls as unknown[][];
const filtersOf = (call: unknown[]) => call[2] as { actorUserId?: string };

/**
 * Filter to Alice, then to Bob, while Alice's response is still in flight. Two
 * requests are now outstanding for the same page; the handles let a test land
 * them in the order that exposes the race (the discarded one last).
 *
 * Pagination cannot reach this state on its own: the pager unmounts while a
 * page is loading, so a second page request cannot be issued before the first
 * resolves. The actor dropdown sits outside the loading branch, so it is the
 * one control that can genuinely overlap two requests.
 */
async function filterTwice() {
  const discarded = deferred<ReturnType<typeof pageOf>>();
  const current = deferred<ReturnType<typeof pageOf>>();

  (api as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { userId: "u-alice", displayName: "Alice", username: "alice" },
    { userId: "u-bob", displayName: "Bob", username: "bob" },
  ]);

  (getActivities as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (_ws: string, _pj: string, filters: { actorUserId?: string }) => {
      if (!filters.actorUserId) return Promise.resolve(pageOf(["1a", "1b"], 1));
      // The second filter change is the request the page is waiting on.
      if (filters.actorUserId === "u-bob") return current.promise;
      return discarded.promise;
    },
  );

  renderPage();
  await waitFor(() => expect(screen.getByText("task-1a")).toBeInTheDocument());

  // The filter bar unmounts when collapsed, so it has to be opened before its
  // controls can overlap an in-flight request. Query the bar by the id the page
  // already keys aria-controls to, so the probe carries no marker of its own.
  fireEvent.click(screen.getByRole("button", { name: "activity.filter" }));
  const actorSelect = async () => {
    const bar = await screen.findByTestId("activity-filter-bar");
    return within(bar).getByLabelText("activity.filterActor") as HTMLSelectElement;
  };

  // The actor dropdown's options come from the members request; changing it
  // before they exist clamps to "all members" and never fires a request.
  await waitFor(async () => expect((await actorSelect()).length).toBeGreaterThan(2));

  fireEvent.change(await actorSelect(), { target: { value: "u-alice" } });
  await waitFor(() =>
    expect(calls().some((c) => filtersOf(c).actorUserId === "u-alice")).toBe(true),
  );

  fireEvent.change(await actorSelect(), { target: { value: "u-bob" } });
  await waitFor(() =>
    expect(calls().some((c) => filtersOf(c).actorUserId === "u-bob")).toBe(true),
  );

  return { discarded, current };
}

describe("ActivitiesPage ignores stale filter responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a late response from a discarded filter does not overwrite the current one", async () => {
    const { discarded, current } = await filterTwice();

    // Bob's results land first, then the older Alice response arrives last.
    current.resolve(pageOf(["b1", "b2"], 1));
    await waitFor(() => expect(screen.getByText("task-b1")).toBeInTheDocument());

    discarded.resolve(pageOf(["a1", "a2"], 1));
    await waitFor(() =>
      expect(screen.queryByText("task-a1")).not.toBeInTheDocument(),
    );

    // The list still belongs to the filter the dropdown actually shows.
    expect(screen.getByText("task-b1")).toBeInTheDocument();
    expect(screen.getByText("task-b2")).toBeInTheDocument();
  });

  it("a late error from a discarded filter does not replace the loaded list", async () => {
    const { discarded, current } = await filterTwice();

    // Alice's request fails while Bob's is still loading. The old code had no
    // generation check, so this setError landed between the two and, with
    // pageData still null, swapped the loading skeletons for the full error
    // card — the user saw a failure for a filter they had already moved past.
    void discarded.promise.catch(() => undefined);
    discarded.reject(new Error("stale 500"));

    // Bob's response is the one the user is waiting on; it must still land.
    current.resolve(pageOf(["b1"], 1));
    await waitFor(() => expect(screen.getByText("task-b1")).toBeInTheDocument());

    // The dead error never reached the screen.
    expect(screen.queryByText("stale 500")).not.toBeInTheDocument();
  });
});
