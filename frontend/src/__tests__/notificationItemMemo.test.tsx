import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState, useCallback } from "react";

// The bell panel polls every 60s, and NotificationsPage refetches on every
// incoming-notification signal. Both rebuild the whole list array; without
// object reuse + one stable handler, every row re-renders on every poll.
// These tests model the full pair: reuseItems (the hook's object reuse) and
// a single useCallback handler passed to every row.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts === "object") {
        const joined = Object.values(opts).map(String).join(",");
        if (joined) return `${k}:${joined}`;
      }
      return k;
    },
  }),
}));

import {
  NotificationItem,
  __notificationItemRenders,
  __resetNotificationItemRenders,
} from "../components/notifications/NotificationItem";
import type { AppNotification } from "../hooks/useNotifications";

function notif(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    type: "task_assigned",
    message: "Assigned Task A to you",
    actorName: "Alice",
    createdAtUtc: "2026-09-20T10:00:00Z",
    kind: "task",
    isRead: false,
    taskId: "t1",
    workspaceId: "ws1",
    projectId: "p1",
    ...overrides,
  };
}

const N1 = notif({ id: "n1" });
const N2 = notif({ id: "n2", message: "Commented on Task B", kind: "comment" });

/** The raw poll response: every object rebuilt, fields unchanged. */
function refetch(items: AppNotification[]): AppNotification[] {
  return items.map((n) => ({ ...n }));
}

/**
 * useNotifications' reuse step: for any id whose fields are unchanged, swap in
 * the object the list already rendered. Without this, new identities always
 * re-render and the memo on the row is helpless.
 */
function reuseItems(
  prev: Map<string, AppNotification>,
  next: AppNotification[],
): AppNotification[] {
  return next.map((n) => {
    const old = prev.get(n.id);
    return old && equalNotification(old, n) ? old : n;
  });
}

function equalNotification(a: AppNotification, b: AppNotification): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.message === b.message &&
    a.actorName === b.actorName &&
    a.createdAtUtc === b.createdAtUtc &&
    a.kind === b.kind &&
    a.isRead === b.isRead &&
    a.taskId === b.taskId &&
    a.workspaceId === b.workspaceId &&
    a.projectId === b.projectId
  );
}

/** One handler for the whole list, exactly like the real call sites. */
function useStableClick() {
  return useCallback((_n: AppNotification) => {}, []);
}

describe("NotificationItem is memoised against the 60s poll", () => {
  afterEach(cleanup);
  beforeEach(() => __resetNotificationItemRenders());

  it("renders each row once on mount", () => {
    render(
      <ul>
        <NotificationItem notification={N1} unread onClick={() => {}} />
        <NotificationItem notification={N2} unread onClick={() => {}} />
      </ul>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(__notificationItemRenders(), "two rows should render once each").toBe(2);
  });

  it("forwards the row's own notification to the handler on click", () => {
    const seen: AppNotification[] = [];
    const p = render(
      <NotificationItem notification={N2} unread onClick={(n) => seen.push(n)} />,
    );
    fireEvent.click(p.getByRole("button"));
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe("n2");
  });

  it("does not re-render a row when the poll rebuilds an equal list", () => {
    function Panel() {
      const [items, setItems] = useState<AppNotification[]>([N1, N2]);
      const handleClick = useStableClick();
      return (
        <ul>
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} unread={!n.isRead} onClick={handleClick} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                const prev = new Map(items.map((n) => [n.id, n]));
                setItems(reuseItems(prev, refetch(items)));
              }}
            >
              poll
            </button>
          </li>
        </ul>
      );
    }
    const p = render(<Panel />);
    expect(__notificationItemRenders()).toBe(2);

    fireEvent.click(p.getByText("poll"));
    fireEvent.click(p.getByText("poll"));
    fireEvent.click(p.getByText("poll"));
    expect(
      __notificationItemRenders(),
      "a structurally-equal poll must not re-render the rows",
    ).toBe(2);
  });

  it("re-renders only the row whose data changed", () => {
    function Panel() {
      const [items, setItems] = useState<AppNotification[]>([N1, N2]);
      const handleClick = useStableClick();
      return (
        <ul>
          {items.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} unread={!n.isRead} onClick={handleClick} />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                const prev = new Map(items.map((n) => [n.id, n]));
                const changed = items.map((n) =>
                  n.id === "n2" ? { ...n, isRead: true } : n,
                );
                setItems(reuseItems(prev, changed));
              }}
            >
              read
            </button>
          </li>
        </ul>
      );
    }
    const p = render(<Panel />);
    expect(__notificationItemRenders()).toBe(2);

    fireEvent.click(p.getByText("read"));
    expect(__notificationItemRenders(), "only the changed row should re-render").toBe(3);
  });

  it("re-renders when the handler identity changes (no over-holding)", () => {
    function Panel() {
      const [tick, setTick] = useState(0);
      // New identity per tick, like a handler that depends on changing state.
      const handleClick = useCallback((_n: AppNotification) => {}, [tick]);
      return (
        <div>
          <NotificationItem notification={N1} unread onClick={handleClick} />
          <button type="button" onClick={() => setTick((t) => t + 1)}>
            poll
          </button>
        </div>
      );
    }
    const p = render(<Panel />);
    expect(__notificationItemRenders()).toBe(1);
    fireEvent.click(p.getByText("poll"));
    expect(__notificationItemRenders(), "a new handler identity must re-render").toBe(2);
  });

  it("no-ops when the handler is absent", () => {
    const p = render(<NotificationItem notification={N1} unread />);
    expect(() => fireEvent.click(p.getByRole("button"))).not.toThrow();
    expect(__notificationItemRenders()).toBe(1);
  });

  it("renders the unread dot only for unread rows", () => {
    __resetNotificationItemRenders();
    const a = render(<NotificationItem notification={N1} unread onClick={() => {}} />);
    expect(a.getByLabelText("notification.unread")).toBeInTheDocument();

    cleanup();
    __resetNotificationItemRenders();
    const b = render(<NotificationItem notification={N1} unread={false} onClick={() => {}} />);
    expect(b.queryByLabelText("notification.unread")).not.toBeInTheDocument();
  });
});
