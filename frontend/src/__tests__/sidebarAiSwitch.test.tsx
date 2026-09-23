import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../components/AppShell";

// Contract for the left-sidebar Nav ↔ AI body switch (replaces the old
// right-edge AiDock):
//  - default mode is nav (localStorage absent → nav body, AI hidden)
//  - switch sits under the logo; toggles aria-pressed + persists
//    devflow.sidebarMode
//  - both modes share lg:w-60 — AI forces expanded even if collapse=1
//  - leaving AI does not surprise-collapse
//  - AI panel stays mounted (hidden) while in nav so chat history survives
//  - outside a workspace the switch is disabled and mode is forced nav
//  - no right-edge dock / AiDock / AiFloatingButton in the shell path

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const WS_PATH = `/workspaces/${WORKSPACE_ID}`;

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    currentUser: { id: "u1", email: "a@b.c", username: "alice", displayName: "Alice" },
  }),
}));

vi.mock("../hooks/useApi", () => ({
  useApi: () => ({ data: null, error: null, loading: true, reload: () => {} }),
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
  pagedItems: (d: unknown) => d,
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
  }: {
    open: boolean;
    variant?: string;
  }) => (
    <div
      data-testid="assistant-panel"
      data-open={String(open)}
      data-variant={variant}
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
  },
) {
  if (!opts?.preserve) {
    localStorage.clear();
    localStorage.setItem(
      "devflow.sidebarCollapsed",
      opts?.collapsed ? "1" : "0",
    );
    if (opts?.mode) localStorage.setItem("devflow.sidebarMode", opts.mode);
    else localStorage.setItem("devflow.sidebarMode", "nav");
  } else if (opts?.mode) {
    localStorage.setItem("devflow.sidebarMode", opts.mode);
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
    expect(aside?.className).toContain("lg:w-60");
    expect(aside?.className).not.toContain("lg:w-[72px]");
    // Preference is cleared so leaving AI does not snap back to 72px.
    expect(localStorage.getItem("devflow.sidebarCollapsed")).toBe("0");
  });

  it("stays expanded when leaving AI (no surprise-collapse)", () => {
    const { container } = renderShell(WS_PATH, { collapsed: true });
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantOpen" }));
    fireEvent.click(screen.getByRole("button", { name: "ai.assistantClose" }));

    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-60");
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

  it("disables the switch outside a workspace and forces nav", () => {
    // UUID path required — /profile has no workspaceId.
    localStorage.setItem("devflow.sidebarMode", "ai");
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <AppShell>
          <div>page content</div>
        </AppShell>
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "ai.assistantOpen" });
    expect(toggle).toHaveProperty("disabled", true);
    // No AI panel without a workspace context.
    expect(screen.queryByTestId("assistant-panel")).toBeNull();
    expect(screen.getByLabelText("ui.sidebarNavAria")).toBeTruthy();
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
    // Dock must not wipe chat history on every open (sidebar keeps mounted).
    expect(src).toMatch(/variant === "floating"\) \{\s*\n\s*setMessages/);
  });
});
