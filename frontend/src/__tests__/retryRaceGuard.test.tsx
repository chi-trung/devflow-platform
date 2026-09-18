import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

// Four pages (custom fields, labels, templates, saved searches) share one
// hand-rolled loader whose retry button is not disabled while a load is in
// flight. Clicking retry twice puts two loads in flight; whichever response
// lands last wins, and the loser can be an error for a retry the user already
// moved past. Only the most recent load may write state.

const stableT = vi.hoisted(() => (key: string) => key);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CustomFieldsPage } from "../pages/CustomFieldsPage";
import { LabelsPage } from "../pages/LabelsPage";
import { TemplatesPage } from "../pages/TemplatesPage";
import { SavedSearchesPage } from "../pages/SavedSearchesPage";
vi.mock("../lib/api", () => ({
  getCustomFields: vi.fn(),
  createCustomField: vi.fn(),
  updateCustomField: vi.fn(),
  deleteCustomField: vi.fn(),
  getLabels: vi.fn(),
  createLabel: vi.fn(),
  deleteLabel: vi.fn(),
  getTemplates: vi.fn(),
  createTemplate: vi.fn(),
  applyTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  getSavedSearches: vi.fn(),
  createSavedSearch: vi.fn(),
  deleteSavedSearch: vi.fn(),
}));

import { getCustomFields, getLabels, getTemplates, getSavedSearches } from "../lib/api";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const api = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;

/**
 * Fail the mount-time load so the retry button appears, then click retry
 * twice. Two loads are now outstanding; the handles let a test land them in
 * the order that exposes the race (the discarded one last).
 *
 * Both clicks have to land inside one act() batch: the first one flips the
 * page into its loading branch, and while the retry button itself is in the
 * header (outside that branch) a standalone fireEvent.click flushes React
 * state, so a second click would find the list re-rendered and not re-fire.
 */
async function doubleRetry(element: React.ReactElement, fetchFn: ReturnType<typeof vi.fn>) {
  const initial = deferred<unknown>();
  const first = deferred<unknown>();
  const second = deferred<unknown>();
  const pending = [initial, first, second];
  fetchFn.mockImplementation(() => pending.shift()!.promise);

  render(
    <MemoryRouter initialEntries={["/workspaces/ws-1/projects/prj-1/x"]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/projects/:projectId/*"
          element={element}
        />
      </Routes>
    </MemoryRouter>,
  );
  void initial.promise.catch(() => undefined);
  initial.reject(new Error("boom"));
  const retry = await screen.findByRole("button", { name: "common.retry" });

  act(() => {
    fireEvent.click(retry);
    fireEvent.click(retry);
  });
  await waitFor(() => expect(fetchFn.mock.calls.length).toBe(3));

  return { first, second };
}

describe("retry races are guarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("custom fields: a late response does not replace the current list", async () => {
    const g = api(getCustomFields);
    const { first, second } = await doubleRetry(<CustomFieldsPage />, g);

    second.resolve([{ id: "2a", name: "second", fieldType: "text", options: null, isRequired: false, sortOrder: 0 }]);
    await waitFor(() => expect(screen.getByText("second")).toBeInTheDocument());

    first.resolve([{ id: "1a", name: "first", fieldType: "text", options: null, isRequired: false, sortOrder: 0 }]);
    await waitFor(() => expect(screen.queryByText("first")).not.toBeInTheDocument());

    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("labels: a late error does not follow a successful retry", async () => {
    const g = api(getLabels);
    const { first, second } = await doubleRetry(<LabelsPage />, g);

    second.resolve([{ id: "2a", name: "second", color: "#10b981", sortOrder: 0 }]);
    await waitFor(() => expect(screen.getByText("second")).toBeInTheDocument());

    // The discarded retry fails after the retry that worked. On the unguarded
    // loader this setError lands anyway, so the page shows an error banner for
    // a retry that succeeded, next to the list it asked for.
    void first.promise.catch(() => undefined);
    first.reject(new Error("stale 500"));
    await waitFor(() =>
      expect(screen.queryByText("stale 500")).not.toBeInTheDocument(),
    );

    // The list the user is looking at is still the one they got, with no
    // banner claiming otherwise.
    expect(screen.getByText("second")).toBeInTheDocument();
    expect(document.querySelector("#labels-load-error")).toBeNull();
  });

  it("templates: a late response does not replace the current list", async () => {
    const g = api(getTemplates);
    const { first, second } = await doubleRetry(<TemplatesPage />, g);

    second.resolve([{ id: "2a", name: "second", description: "", taskTemplateJson: null, createdAtUtc: "" }]);
    await waitFor(() => expect(screen.getByText("second")).toBeInTheDocument());

    first.resolve([{ id: "1a", name: "first", description: "", taskTemplateJson: null, createdAtUtc: "" }]);
    await waitFor(() => expect(screen.queryByText("first")).not.toBeInTheDocument());

    expect(screen.getByText("second")).toBeInTheDocument();
  });

  it("saved searches: a late error does not follow a successful retry", async () => {
    const g = api(getSavedSearches);
    const { first, second } = await doubleRetry(<SavedSearchesPage />, g);

    second.resolve([{ id: "2a", name: "second", workspaceId: "ws-1", query: "q", filtersJson: "{}", createdAtUtc: "" }]);
    await waitFor(() => expect(screen.getByText("second")).toBeInTheDocument());

    // The discarded retry fails after the retry that worked. On the unguarded
    // loader this setError lands anyway, so the page shows an error banner for
    // a retry that succeeded, next to the list it asked for.
    void first.promise.catch(() => undefined);
    first.reject(new Error("stale 500"));
    await waitFor(() =>
      expect(screen.queryByText("stale 500")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("second")).toBeInTheDocument();
    expect(document.querySelector("#saved-searches-load-error")).toBeNull();
  });
});
