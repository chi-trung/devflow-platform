// Regression for the silent optimistic revert in useNotifications: markRead,
// markUnread and markAllRead patched the local list, fired the API call with
// void ...().catch(...), and on rejection ONLY rolled the state back — no
// toast, no banner. In the bell dropdown (NotificationsPanel is the only
// surface using these hook methods; NotificationsPage has its own await +
// setError handlers) a failed click looked like a flicker: unread -> read ->
// unread with zero explanation. The notification.mark*Failed keys existed in
// both locales but had no caller.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotifications } from "../hooks/useNotifications";
import * as api from "../lib/api";
import type { NotificationResponse } from "../types/api";

vi.mock("../lib/api");

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const push = vi.fn();
vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ push }),
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "u1" } }),
}));

vi.mock("../lib/realtime", () => ({
  getNotificationConnection: () => ({ on: vi.fn(), off: vi.fn() }),
  parseNotificationPayload: (p: unknown) => p,
  startNotificationStream: vi.fn(async () => {}),
  stopNotificationStream: vi.fn(),
}));

function raw(overrides: Partial<NotificationResponse> = {}) {
  return {
    id: "n1",
    type: "task",
    message: "hello",
    actorName: null,
    createdAtUtc: "2026-09-16T00:00:00Z",
    readAtUtc: null,
    taskItemId: null,
    workspaceId: null,
    projectId: null,
    ...overrides,
  } as NotificationResponse;
}

function page(items: NotificationResponse[]) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
}

describe("useNotifications reports mark failures", () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(api.getNotifications).mockReset();
    vi.mocked(api.markNotificationRead).mockReset();
    vi.mocked(api.markNotificationUnread).mockReset();
    vi.mocked(api.markAllNotificationsRead).mockReset();
    vi.mocked(api.getNotifications).mockResolvedValue(page([raw()]));
  });

  async function mount() {
    const { result } = renderHook(() => useNotifications(null, true));
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));
    return result;
  }

  it("toasts when markRead rejects and rolls the row back to unread", async () => {
    vi.mocked(api.markNotificationRead).mockRejectedValueOnce(new Error("x"));
    const result = await mount();
    act(() => result.current.markRead("n1"));
    expect(result.current.notifications[0].isRead).toBe(true); // optimistic
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("notification.markReadFailed", "error"),
    );
    expect(result.current.notifications[0].isRead).toBe(false); // reverted
  });

  it("toasts when markUnread rejects and rolls the row back to read", async () => {
    vi.mocked(api.getNotifications).mockResolvedValue(
      page([raw({ readAtUtc: "2026-09-16T01:00:00Z" })]),
    );
    vi.mocked(api.markNotificationUnread).mockRejectedValueOnce(new Error("x"));
    const result = await mount();
    act(() => result.current.markUnread("n1"));
    expect(result.current.notifications[0].isRead).toBe(false); // optimistic
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "notification.markUnreadFailed",
        "error",
      ),
    );
    expect(result.current.notifications[0].isRead).toBe(true); // reverted
  });

  it("toasts when markAllRead rejects", async () => {
    vi.mocked(api.markAllNotificationsRead).mockRejectedValueOnce(new Error("x"));
    const result = await mount();
    act(() => result.current.markAllRead());
    expect(result.current.notifications[0].isRead).toBe(true); // optimistic
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "notification.markAllReadFailed",
        "error",
      ),
    );
  });

  it("stays quiet when the marks succeed", async () => {
    vi.mocked(api.markNotificationRead).mockResolvedValue(
      undefined as Awaited<ReturnType<typeof api.markNotificationRead>>,
    );
    vi.mocked(api.markAllNotificationsRead).mockResolvedValue(
      undefined as Awaited<ReturnType<typeof api.markAllNotificationsRead>>,
    );
    const result = await mount();
    act(() => result.current.markRead("n1"));
    act(() => result.current.markAllRead());
    await waitFor(() => expect(api.markNotificationRead).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
