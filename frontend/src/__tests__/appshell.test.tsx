import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../components/AppShell";

// AppShell depends on AuthContext + useApi + i18n. Mock the heavy parts; the
// collapse logic lives purely in AppShell so a light DOM check suffices.
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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

// Portal-based children (CommandPalette, UserMenu, NotificationsPanel…) use
// createPortal to document.body — fine in jsdom.
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

function renderShell(path = "/workspaces/ws1", collapsedPref = false) {
  localStorage.clear();
  localStorage.setItem("devflow.sidebarCollapsed", collapsedPref ? "1" : "0");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell>
        <div>page content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell sidebar collapse", () => {
  it("collapses to the icon rail when the preference is set", () => {
    const { container } = renderShell("/workspaces/ws1", true);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-[72px]");
  });

  it("expands to full width when the toggle is clicked", () => {
    const { container } = renderShell("/workspaces/ws1", true);
    const aside = container.querySelector("aside");
    const toggle = screen.getByRole("button", { name: "nav.expand" });
    expect(aside?.className).toContain("lg:w-[72px]");

    fireEvent.click(toggle);
    expect(aside?.className).toContain("lg:w-60");
    expect(localStorage.getItem("devflow.sidebarCollapsed")).toBe("0");
  });

  it("collapses when the toggle is clicked again", () => {
    const { container } = renderShell("/workspaces/ws1", false);
    const aside = container.querySelector("aside");
    const toggle = screen.getByRole("button", { name: "nav.collapse" });
    expect(aside?.className).toContain("lg:w-60");

    fireEvent.click(toggle);
    expect(aside?.className).toContain("lg:w-[72px]");
    expect(localStorage.getItem("devflow.sidebarCollapsed")).toBe("1");
  });

  it("persists the collapsed state across renders", () => {
    const { container } = renderShell("/workspaces/ws1", false);
    const toggle = screen.getByRole("button", { name: "nav.collapse" });
    fireEvent.click(toggle);
    expect(container.querySelector("aside")?.className).toContain("lg:w-[72px]");

    // Re-render with a new shell (simulates page reload) — preference still "1"
    const { container: c2 } = renderShell("/workspaces/ws1", true);
    expect(c2.querySelector("aside")?.className).toContain("lg:w-[72px]");
  });

  it("keeps the closed mobile drawer out of the tab order", () => {
    // -translate-x-full alone leaves the offscreen links focusable; the closed
    // state must also carry invisible (with lg:visible so the desktop rail
    // stays shown). Opening must drop invisible, not override it.
    const { container } = renderShell("/workspaces/ws1", false);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("-translate-x-full invisible lg:visible");

    fireEvent.click(screen.getByRole("button", { name: "ui.openMenuAria" }));
    expect(aside?.className).toContain("translate-x-0");
    expect(aside?.className).not.toContain("invisible");
  });

  it("makes the background inert and moves focus into the open drawer", () => {
    // The open drawer behaves as a modal: page chrome behind it is inert, and
    // focus enters the drawer so keyboard users are not stranded on body.
    const { container } = renderShell("/workspaces/ws1", false);
    const inertBefore = container.querySelector("main")?.hasAttribute("inert");
    expect(inertBefore).toBe(false);

    // A real click focuses the trigger first; jsdom's fireEvent does not, so
    // focus it explicitly to also exercise the restore-on-close path.
    const trigger = screen.getByRole("button", { name: "ui.openMenuAria" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(container.querySelector("main")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("header")?.hasAttribute("inert")).toBe(true);
    // The bottom bar is the nav with the primary-nav label, not the sidebar's
    // own nav sections.
    expect(
      container
        .querySelector('nav[aria-label="ui.primaryNavAria"]')
        ?.hasAttribute("inert"),
    ).toBe(true);

    // Focus must land on a control inside the drawer, not stay on body — the
    // prod bug was focus() running while the element was still transition-
    // hidden, which silently no-ops.
    const aside = container.querySelector("aside");
    expect(aside?.contains(document.activeElement)).toBe(true);

    // Two elements share the close label (the drawer's X and the overlay);
    // Escape exercises the same close path without the ambiguity.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(container.querySelector("main")?.hasAttribute("inert")).toBe(false);
    expect(aside?.contains(document.activeElement)).toBe(false);
  });

  it("swaps the account trigger to icon-only when collapsed (no name overflow)", () => {
    // Collapsed: the sidebar UserMenu renders compact (avatar initials + long
    // username/email hidden) so a long Gmail address can't stick out of the
    // narrow rail. The username "alice" and email "a@b.c" must be absent.
    renderShell("/workspaces/ws1", true);
    expect(screen.queryByText("alice")).toBeNull();
    expect(screen.queryByText("a@b.c")).toBeNull();

    // Expanded: the full trigger returns — the mock user's initials "A" avatar
    // plus username/email are rendered again.
    renderShell("/workspaces/ws1", false);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText("a@b.c")).toBeTruthy();
  });
});
