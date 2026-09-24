import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../components/AppShell";

// Contract for the left-sidebar Nav ↔ AI body switch (replaces the old
// right-edge AiDock):
//  - default mode is nav (localStorage absent → nav body, AI hidden)
//  - switch sits under the logo; toggles aria-pressed + persists
//    devflow.sidebarMode
//  - both modes share lg:w-80 — AI forces expanded even if collapse=1
//  - leaving AI does not surprise-collapse
//  - AI panel stays mounted (hidden) while in nav so chat history survives
//  - AI works on every AppShell page: route workspaceId, else last visited
//    (devflow.lastWorkspaceId), else first member workspace
//  - switch disabled only when NO workspace id is available at all
//  - no right-edge dock / AiDock / AiFloatingButton in the shell path

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const FALLBACK_WS_ID = "22222222-2222-4222-8222-222222222222";
const WS_PATH = `/workspaces/${WORKSPACE_ID}`;

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    currentUser: { id: "u1", email: "a@b.c", username: "alice", displayName: "Alice" },
  }),
}));

// Controllable so tests can feed the /workspaces list (AI fallback id)
// without depending on the projects useApi call shape.
let mockWorkspaces: unknown = null;

vi.mock("../hooks/useApi", () => ({
  useApi: (fetcher?: () => Promise<unknown>) => {
    const src = String(fetcher ?? "");
    // AppShell's workspace list fetch is `api("/workspaces")` — distinguish
    // it from `…/workspaces/{id}/projects` (and any other gated fetch).
    if (src.includes("/workspaces") && !src.includes("/projects")) {
      return {
        data: mockWorkspaces,
        error: null,
        loading: mockWorkspaces === null,
        reload: () => {},
      };
    }
    return { data: null, error: null, loading: false, reload: () => {} };
  },
}));

vi.mock("../hooks/useWorkspaceEvents", () => ({
  useWorkspaceEvents: () => {},
}));

const tMock = (k: string) => k;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: tMock }),
}));

vi.mock("../lib/api", () => ({
  api: () => Promise.resolve([]),
  // Mirror production: arrays pass through, paged envelopes unwrap .items.
  pagedItems: (d: unknown) => {
    if (Array.isArray(d)) return d;
    if (d && typeof d === "object" && "items" in d) {
      const items = (d as { items: unknown }).items;
      return Array.isArray(items) ? items : [];
    }
    return [];
  },
}));

vi.mock("../lib/realtime", () => ({
  getNotificationConnection: () => ({
    on: () => {},
    off: () => {},
    start: () => Promise.resolve(),
    stop: () => Promise.resolve(),
    state: "Disconnected",
  }),
  useWorkspaceChannel: () => ({}),
}));

vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => ({
    unread: 0,
    notifications: [],
    loading: false,
  }),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push: () => {} }),
}));

// Isolate the shell contract from the real panel (api calls, rAF focus).
vi.mock("../components/ai/AiAssistantPanel", () => ({
  AiAssistantPanel: ({
    open,
    variant,
    workspaceId,
  }: {
    open: boolean;
    variant?: string;
    workspaceId?: string;
  }) => (
    <div
      data-testid="assistant-panel"
      data-open={String(open)}
      data-variant={variant}
      data-workspace-id={workspaceId}
    >
      <textarea aria-label="composer" />
    </div>
  ),
}));

function renderShell(
  path = WS_PATH,
  opts?: {
    collapsed?: boolean;
    mode?: "nav" | "ai";
    /** Skip the localStorage wipe (remount / reload probes). */
    preserve?: boolean;
    /** Seed devflow.lastWorkspaceId after the wipe. */
    lastWorkspaceId?: string;
    /** Workspace list returned by the mocked /workspaces useApi. */
    workspaces?: unknown;
  },
) {
  if (opts?.workspaces !== undefined) mockWorkspaces = opts.workspaces;
  if (!opts?.preserve) {
    localStorage.clear();
    localStorage.setItem(
      "devflow.sidebarCollapsed",
      opts?.collapsed ? "1" : "0",
    );
    if (opts?.mode) localStorage.setItem("devflow.sidebarMode", opts.mode);
    else localStorage.setItem("devflow.sidebarMode", "nav");
    if (opts?.lastWorkspaceId) {
      localStorage.setItem("devflow.lastWorkspaceId", opts.lastWorkspaceId);
    }
  } else {
    if (opts?.mode) localStorage.setItem("devflow.sidebarMode", opts.mode);
    if (opts?.lastWorkspaceId) {
      localStorage.setItem("devflow.lastWorkspaceId", opts.lastWorkspaceId);
    }
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <div>page content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mockWorkspaces = null;
});

describe("sidebar Nav ↔ AI switch", () => {
  it("starts in nav mode with the AI panel hidden but mounted", () => {
    const { container } = renderShell();
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    // Nav body visible
    expect(screen.getByLabelText("ui.sidebarNavAria")).toBeTruthy();
    // AI body mounted (history survives) but display:none + aria-hidden
    const panel = screen.getByTestId("assistant-panel");
    expect(panel.dataset.open).toBe("false");
    expect(panel.dataset.variant).toBe("dock");
    expect(container.querySelector("#sidebar-ai-panel")?.getAttribute("aria-hidden")).toBe("true");
    expect(
      container.querySelector("#sidebar-ai-panel")?.classList.contains("hidden"),
    ).toBe(true);
    expect(localStorage.getItem("devflow.sidebarMode")).toBe("nav");
  });

  it("opens AI on click, hides nav, flips aria-pressed, and persists", () => {
    const { container } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));

    const toggle = screen.getByRole("button", { name: "ai.assistantClose" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("ui.sidebarNavAria")).toBeNull();
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("true");
    expect(
      container.querySelector("#sidebar-ai-panel")?.getAttribute("aria-hidden"),
    ).toBe("false");
    // classList token — `overflow-hidden` must not trip a substring check.
    expect(
      container.querySelector("#sidebar-ai-panel")?.classList.contains("hidden"),
    ).toBe(false);
    expect(localStorage.getItem("devflow.sidebarMode")).toBe("ai");
    // Opening does not move focus in the shell (the real panel rAF-focuses
    // the composer; the mock does not). Closing returns focus to the switch —
    // covered in the second-click test.
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
  });

  it("restores AI mode across remounts", () => {
    const { unmount } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    expect(localStorage.getItem("devflow.sidebarMode")).toBe("ai");
    unmount();

    // preserve: simulate reload — wipe must not erase the just-written mode.
    renderShell(WS_PATH, { preserve: true });
    expect(
      screen.getByRole("button", { name: "ai.assistantClose" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("true");
  });

  it("returns to nav on second click and focuses the switch", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantClose" }));

    const closed = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(closed.getAttribute("aria-pressed")).toBe("false");
    expect(document.activeElement).toBe(closed);
    expect(localStorage.getItem("devflow.sidebarMode")).toBe("nav");
    // Still mounted — exit is hide, not an unmount (chat history).
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("false");
  });

  it("forces expanded width when entering AI from a collapsed rail", () => {
    const { container } = renderShell(WS_PATH, { collapsed: true });
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-[72px]");

    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    expect(aside?.className).toContain("lg:w-80");
    expect(aside?.className).not.toContain("lg:w-[72px]");
    // Preference is cleared so leaving AI does not snap back to 72px.
    expect(localStorage.getItem("devflow.sidebarCollapsed")).toBe("0");
  });

  it("stays expanded when leaving AI (no surprise-collapse)", () => {
    const { container } = renderShell(WS_PATH, { collapsed: true });
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantClose" }));

    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-80");
    expect(aside?.className).not.toContain("lg:w-[72px]");
    // Collapse control is back (hidden while in AI). Entering AI cleared the
    // collapse pref, so the control offers "collapse" again, not "expand".
    expect(screen.getByRole("button", { name: "nav.collapse" })).toBeTruthy();
  });

  it("hides the collapse control while AI mode is active", () => {
    renderShell(WS_PATH, { collapsed: false });
    expect(screen.getByRole("button", { name: "nav.collapse" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    expect(screen.queryByRole("button", { name: "nav.collapse" })).toBeNull();
    expect(screen.queryByRole("button", { name: "nav.expand" })).toBeNull();
  });

  it("disables the switch only when no workspace id exists at all", () => {
    // /profile has no route workspace; list empty; no last-visited id.
    localStorage.setItem("devflow.sidebarMode", "ai");
    mockWorkspaces = null;
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle).toHaveProperty("disabled", true);
    // No AI panel without any workspace context.
    expect(screen.queryByTestId("assistant-panel")).toBeNull();
    expect(screen.getByLabelText("ui.sidebarNavAria")).toBeTruthy();
  });

  it("enables AI outside a workspace via last-visited fallback", () => {
    // Simulate: visited a workspace earlier, now on /profile or /.
    renderShell("/profile", {
      mode: "nav",
      lastWorkspaceId: WORKSPACE_ID,
    });
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle).toHaveProperty("disabled", false);
    const panel = screen.getByTestId("assistant-panel");
    expect(panel.dataset.workspaceId).toBe(WORKSPACE_ID);

    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "ai.assistantClose" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("true");
    expect(screen.queryByLabelText("ui.sidebarNavAria")).toBeNull();
  });

  it("enables AI on / using the first member workspace", () => {
    // Fresh browser: no last-visited id — first workspace from the list.
    renderShell("/", {
      mode: "nav",
      workspaces: {
        items: [
          {
            id: FALLBACK_WS_ID,
            name: "Acme",
            slug: "acme",
            description: null,
            role: "owner",
          },
        ],
      },
    });
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle).toHaveProperty("disabled", false);
    expect(screen.getByTestId("assistant-panel").dataset.workspaceId).toBe(
      FALLBACK_WS_ID,
    );
  });

  it("prefers a last-visited id that is still a member over the first workspace", () => {
    renderShell("/settings", {
      mode: "nav",
      lastWorkspaceId: FALLBACK_WS_ID,
      workspaces: {
        items: [
          { id: WORKSPACE_ID, name: "A", slug: "a", description: null, role: "owner" },
          { id: FALLBACK_WS_ID, name: "B", slug: "b", description: null, role: "member" },
        ],
      },
    });
    expect(screen.getByTestId("assistant-panel").dataset.workspaceId).toBe(
      FALLBACK_WS_ID,
    );
  });

  it("falls back to the first workspace when last-visited membership is gone", () => {
    // last id is no longer in the member list → fail closed to list[0].
    renderShell("/settings", {
      mode: "nav",
      lastWorkspaceId: WORKSPACE_ID,
      workspaces: {
        items: [
          { id: FALLBACK_WS_ID, name: "B", slug: "b", description: null, role: "owner" },
        ],
      },
    });
    expect(screen.getByTestId("assistant-panel").dataset.workspaceId).toBe(
      FALLBACK_WS_ID,
    );
  });

  it("keeps remembered AI mode on / when a fallback workspace exists", () => {
    // Stale sidebarMode=ai used to force-nav and blank the panel — now it
    // re-opens against the fallback workspace.
    renderShell("/", {
      mode: "ai",
      lastWorkspaceId: WORKSPACE_ID,
    });
    const toggle = screen.getByRole("button", { name: "ai.assistantClose" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.open).toBe("true");
    expect(screen.getByTestId("assistant-panel").dataset.workspaceId).toBe(
      WORKSPACE_ID,
    );
    expect(screen.queryByLabelText("ui.sidebarNavAria")).toBeNull();
  });

  it("persists a route workspace id for later non-workspace pages", () => {
    renderShell(WS_PATH);
    expect(localStorage.getItem("devflow.lastWorkspaceId")).toBe(WORKSPACE_ID);
  });

  it("exposes the same switch inside the mobile drawer", () => {
    // The switch lives in the shared aside — opening the drawer shows it.
    renderShell();
    // aria-pressed toggle works the same regardless of drawer visibility.
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle.closest("aside")).toBeTruthy();
    fireEvent.click(toggle);
    expect(
      screen.getByRole("button", { name: "ai.assistantClose" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

describe("right-edge dock is gone", () => {
  it("does not import AiDock or render a fixed right rail", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appShell = readFileSync(
      join(__dirname, "..", "components", "AppShell.tsx"),
      "utf8",
    );
    expect(appShell).not.toMatch(/AiDock/);
    expect(appShell).not.toMatch(/AiFloatingButton/);
    expect(appShell).not.toMatch(/fixed inset-y-0 right-0/);
    expect(appShell).not.toMatch(/z-\[45\]/);

    let dockGone = false;
    try {
      readFileSync(
        join(__dirname, "..", "components", "ai", "AiDock.tsx"),
      );
    } catch {
      dockGone = true;
    }
    expect(dockGone, "AiDock.tsx should be deleted").toBe(true);

    let fabGone = false;
    try {
      readFileSync(
        join(__dirname, "..", "components", "ai", "AiFloatingButton.tsx"),
      );
    } catch {
      fabGone = true;
    }
    expect(fabGone, "AiFloatingButton.tsx should stay deleted").toBe(true);
  });

  it("keeps the dock panel mounted for variant=dock even when open=false", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "..", "components", "ai", "AiAssistantPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/variant === "floating" && !open/);
    expect(src).toMatch(/variant\?: "floating" \| "dock"/);
    expect(src).toMatch(/variant === "dock"\s*\n?\s*\?/);
    // Transcript is persisted per workspace and restored on mount — opening
    // (floating or dock) must never wipe messages to [].
    expect(src).toMatch(/loadAiChatHistory\(/);
    expect(src).toMatch(/saveAiChatHistory\(/);
    expect(src).not.toMatch(/if \(variant === "floating"\) \{\s*\n\s*setMessages\(\[\]\)/);
    // Dock sits under the Nav↔AI switch which already says "AI Assistant" —
    // the panel header must not render a second title (visual duplicate).
    expect(src).toMatch(/variant !== "dock"/);
  });
});
