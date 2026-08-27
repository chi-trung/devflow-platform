import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../components/AppShell";

// AppShell depends on AuthContext + useApi + i18n. Mock the heavy parts; the
// peek/collapse logic lives purely in AppShell so a light DOM check suffices.
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

describe("AppShell sidebar hover-expand", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses to the 64px rail when the preference is set", () => {
    const { container } = renderShell("/workspaces/ws1", true);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-16");
  });

  it("hovering the rail expands it (peek) without saving the pref", () => {
    const { container } = renderShell("/workspaces/ws1", true);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-16");

    // Peek: hover the aside -> rail expands to w-60
    fireEvent.mouseEnter(aside!);
    expect(aside?.className).toContain("lg:w-60");
    // The pinned pref is untouched while peeking.
    expect(localStorage.getItem("devflow.sidebarCollapsed")).toBe("1");
  });

  it("leaving the rail collapses it back after the grace period", () => {
    const { container } = renderShell("/workspaces/ws1", true);
    const aside = container.querySelector("aside");
    fireEvent.mouseEnter(aside!);
    expect(aside?.className).toContain("lg:w-60");

    fireEvent.mouseLeave(aside!);
    // Still expanded within the 250ms grace.
    expect(aside?.className).toContain("lg:w-60");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(aside?.className).toContain("lg:w-16");
  });

  it("does not peek when the sidebar is pinned open", () => {
    const { container } = renderShell("/workspaces/ws1", false);
    const aside = container.querySelector("aside");
    expect(aside?.className).toContain("lg:w-60");
    fireEvent.mouseEnter(aside!);
    fireEvent.mouseLeave(aside!);
    vi.advanceTimersByTime(300);
    // No change — not collapsed, so hover does nothing.
    expect(aside?.className).toContain("lg:w-60");
  });
});
