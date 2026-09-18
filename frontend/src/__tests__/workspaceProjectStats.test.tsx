import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// The workspace page used to fire ONE /projects/{id}/tasks request per project
// card, purely to render "2/4 done · 50%". A workspace with N projects meant N
// round trips on every load (and again after every workspace-event reload),
// each of them pulling a full task page it only counted. The counts now come
// from a single batched /projects/task-stats endpoint.
//
// This test pins the two behaviours that the old fan-out happened to provide
// and that a naive rewrite could lose:
//  1. one stats request, regardless of how many projects there are;
//  2. a project missing from that response renders the honest "—" (null),
//     never "0/0 done · 0%", which would claim an empty project.

const stableT = vi.hoisted(() => {
  // Resolve from the real English bundle, the way production does, so the
  // assertions read the copy a user actually sees ("2/4 done") rather than a
  // key. Only the handful of keys this page needs are carried here.
  const copy: Record<string, string> = {
    "workspace.progressDone": "{{done}}/{{total}} done",
    "workspace.progressUnknown": "Progress unavailable",
  };
  return (key: string, opts?: Record<string, unknown>) => {
    let out = copy[key] ?? key;
    if (typeof opts === "object" && opts !== null) {
      for (const [k, v] of Object.entries(opts)) out = out.replace(`{{${k}}}`, String(v));
    }
    return out;
  };
});
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: stableT }) }));

vi.mock("../components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: vi.fn() }),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    currentUser: { id: "u1", name: "Alice", email: "alice@example.com" },
  }),
}));

vi.mock("../lib/realtime", () => ({
  getNotificationConnection: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  joinWorkspaceGroup: vi.fn(),
  unjoinWorkspaceGroup: vi.fn(),
  startNotificationStream: vi.fn(async () => {}),
  stopNotificationStream: vi.fn(),
}));

const routes: Record<string, unknown> = {
  "/workspaces/ws-1": { id: "ws-1", name: "Acme", key: "ACME" },
  "/workspaces/ws-1/members": [],
};

vi.mock("../lib/api", () => ({
  api: vi.fn(async (path: string) => {
    if (path in routes) return routes[path];
    return [];
  }),
  pagedItems: vi.fn(<T,>(response: unknown) => {
    const r = response as { items?: T[] };
    return Array.isArray(r?.items) ? r.items : [];
  }),
  updateProject: vi.fn(),
  updateWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  restoreProject: vi.fn(),
  updateMemberRole: vi.fn(),
}));

import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspacePage } from "../pages/WorkspacePage";
import { api } from "../lib/api";

const statsPath = "/workspaces/ws-1/projects/task-stats";

function projects(count: number) {
  routes["/workspaces/ws-1/projects"] = {
    items: Array.from({ length: count }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Project ${i + 1}`,
      key: `P${i + 1}`,
      status: "Active",
    })),
    totalCount: count,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };
}

const callsTo = (path: string) =>
  (api as unknown as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === path);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkspacePage task stats are batched, not one request per project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks the batched endpoint once for any number of projects", async () => {
    projects(6);
    renderPage();

    await waitFor(() => {
      expect(callsTo(statsPath)).toHaveLength(1);
    });
    // The fan-out it replaced: six /projects/{id}/tasks calls.
    expect(
      (api as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(([p]) =>
        /\/projects\/p\d+\/tasks$/.test(String(p)),
      ),
    ).toHaveLength(0);
  });

  it("one stats request when there is exactly one project too", async () => {
    projects(1);
    renderPage();

    await waitFor(() => {
      expect(callsTo(statsPath)).toHaveLength(1);
    });
  });

  it("renders the counts the endpoint returned", async () => {
    projects(2);
    routes[statsPath] = [
      { projectId: "p1", totalTasks: 4, doneTasks: 2 },
      { projectId: "p2", totalTasks: 10, doneTasks: 10 },
    ];
    renderPage();

    expect(await screen.findByText("2/4 done")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("10/10 done")).toBeInTheDocument();
    expect(screen.getAllByText("100%")).toHaveLength(1);
  });

  it("renders the honest unknown for a project the response omits", async () => {
    projects(2);
    // p2 has tasks, but the response only carries p1.
    routes[statsPath] = [{ projectId: "p1", totalTasks: 4, doneTasks: 2 }];
    renderPage();

    expect(await screen.findByText("2/4 done")).toBeInTheDocument();
    // Not "0/0 done · 0%": that would claim p2 is empty over real tasks.
    expect(screen.queryByText("0/0 done")).not.toBeInTheDocument();
    expect(screen.getByText("Progress unavailable")).toBeInTheDocument();
  });

  it("a failed stats fetch leaves every project unknown rather than zero", async () => {
    projects(3);
    routes[statsPath] = new Error("503");
    renderPage();

    expect(await screen.findAllByText("Progress unavailable")).toHaveLength(3);
    expect(screen.queryByText("0/0 done")).not.toBeInTheDocument();
  });

  it("survives a malformed response without crashing or inventing counts", async () => {
    projects(1);
    routes[statsPath] = { not: "an array" };
    renderPage();

    expect(await screen.findByText("Progress unavailable")).toBeInTheDocument();
  });
});
