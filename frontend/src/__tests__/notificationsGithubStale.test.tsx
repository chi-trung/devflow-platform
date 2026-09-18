import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

// NotificationsPage and GitHubPage held the last two hand-rolled loaders with
// no generation check. NotificationsPage's filter tabs are load-effect deps
// and are never disabled, so switching tabs while a page loads puts two
// requests in flight; GitHubPage's two retry buttons are never disabled, so a
// double-click does the same. Whichever response lands last wins, and the
// loser can be an error for a request the page already moved past. Only the
// most recent request may write state.

const stableT = vi.hoisted(() => (key: string) => key);
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// useNotifications pulls in useToast and useAuth, neither of which this race
// is about; the panel's own polling list is independent of the page state.
vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null,
    refresh: vi.fn(),
    markRead: vi.fn(),
    markUnread: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));

// The settings section has its own toast-backed mutations; it is not part of
// the page's load path, so render it as nothing.
vi.mock("../components/settings/GitHubSettingsSection", () => ({
  GitHubSettingsSection: () => null,
}));

vi.mock("../lib/api", () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
  deleteNotification: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteAllReadNotifications: vi.fn(),
  getGitHubIntegration: vi.fn(),
  getProjectPRs: vi.fn(),
  linkGitHubRepo: vi.fn(),
  unlinkGitHubRepo: vi.fn(),
  addPR: vi.fn(),
  deletePR: vi.fn(),
}));

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { NotificationsPage } from "../pages/NotificationsPage";
import { GitHubPage } from "../pages/GitHubPage";
import { getNotifications, getGitHubIntegration, getProjectPRs } from "../lib/api";

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

function pageOf(ids: string[]) {
  return {
    items: ids.map((id) => ({
      id,
      type: "task_updated",
      message: `notif-${id}`,
      actorName: null,
      readAtUtc: null,
      createdAtUtc: "2026-09-18T00:00:00Z",
      taskItemId: null,
    })),
    totalCount: ids.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

describe("stale responses are discarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifications: a late response from a moved-past filter does not replace the list", async () => {
    const g = api(getNotifications);
    const initial = deferred<unknown>();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const pending = [initial, first, second];
    g.mockImplementation(() => pending.shift()!.promise);

    render(
      <MemoryRouter initialEntries={["/notifications"]}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // The mount load has to settle before the tab change can race it.
    initial.resolve(pageOf([]));
    await waitFor(() => expect(g.mock.calls.length).toBe(1));

    // Switch tabs twice while the first tab's response is still in flight.
    fireEvent.click(screen.getByRole("button", { name: "notificationPage.filterUnread" }));
    await waitFor(() => expect(g.mock.calls.length).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "notificationPage.filterMentions" }));
    await waitFor(() => expect(g.mock.calls.length).toBe(3));

    // The newer response lands first, then the older one arrives last.
    second.resolve(pageOf(["m1", "m2"]));
    await waitFor(() => expect(screen.getByText("notif-m1")).toBeInTheDocument());

    first.resolve(pageOf(["u1", "u2"]));
    await waitFor(() =>
      expect(screen.queryByText("notif-u1")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("notif-m1")).toBeInTheDocument();
    expect(screen.getByText("notif-m2")).toBeInTheDocument();
  });

  it("github: a late response from a discarded retry does not replace the PR list", async () => {
    const integ = api(getGitHubIntegration);
    const prs = api(getProjectPRs);
    // Each loadData fans out to both, so settle them as (integration, PRs)
    // pairs in call order: mount pair, first retry pair, second retry pair.
    const integD = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()];
    const prsD = [deferred<unknown>(), deferred<unknown>(), deferred<unknown>()];
    let n = 0;
    integ.mockImplementation(() => integD[n].promise);
    prs.mockImplementation(() => {
      const d = prsD[n];
      n += 1;
      return d.promise;
    });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/projects/prj-1/github"]}>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/projects/:projectId/github"
            element={<GitHubPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(integ.mock.calls.length).toBe(1));

    // Let the mount load fail so the retry buttons appear. The page renders
    // one for the integration card and one for the PR list; the PR one is the
    // one whose rows the assertion reads.
    void integD[0].promise.catch(() => undefined);
    integD[0].reject(new Error("boom"));
    void prsD[0].promise.catch(() => undefined);
    prsD[0].reject(new Error("boom"));
    const retry = (await screen.findAllByRole("button", { name: "common.retry" }))[1];

    // Two retries = two loadData fan-outs, each a fresh (integration, PRs) pair.
    act(() => {
      fireEvent.click(retry);
      fireEvent.click(retry);
    });
    await waitFor(() => expect(integ.mock.calls.length).toBe(3));

    // The newest pair lands first; the discarded pair arrives last.
    integD[2].resolve({ id: "i2", repoFullName: "org/repo", webhookSecret: null });
    prsD[2].resolve([{ id: "pr2", number: 2, title: "second PR", state: "open", url: "https://x/2", author: "a", createdAtUtc: "" }]);
    await waitFor(() => expect(screen.getByText("second PR")).toBeInTheDocument());

    integD[1].resolve({ id: "i1", repoFullName: "org/old", webhookSecret: null });
    prsD[1].resolve([{ id: "pr1", number: 1, title: "first PR", state: "open", url: "https://x/1", author: "a", createdAtUtc: "" }]);
    await waitFor(() =>
      expect(screen.queryByText("first PR")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("second PR")).toBeInTheDocument();
  });
});
