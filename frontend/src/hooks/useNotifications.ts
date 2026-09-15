import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getNotifications,
  markAllNotificationsRead as markAllReadApi,
  markNotificationRead as markReadApi,
  markNotificationUnread as markUnreadApi,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import {
  getNotificationConnection,
  parseNotificationPayload,
  startNotificationStream,
  stopNotificationStream,
  type IncomingNotification,
} from "../lib/realtime";
import type { NotificationResponse } from "../types/api";

const MAX_ITEMS = 20;

export interface AppNotification {
  id: string;
  type: string;
  message: string;
  actorName: string | null;
  createdAtUtc: string;
  kind: "comment" | "sprint" | "task" | "other";
  isRead: boolean;
  taskId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

function kindFromText(text: string): AppNotification["kind"] {
  const t = text.toLowerCase();
  if (t.includes("comment")) return "comment";
  if (t.includes("sprint") || t.includes("backlog")) return "sprint";
  if (t.includes("task") || t.includes("assigned")) return "task";
  return "other";
}

function fromApi(n: NotificationResponse): AppNotification {
  return {
    id: n.id,
    type: n.type,
    message: n.message,
    actorName: n.actorName ?? null,
    createdAtUtc: n.createdAtUtc,
    kind: kindFromText(n.type || n.message),
    isRead: n.readAtUtc !== null,
    taskId: n.taskItemId ?? null,
    workspaceId: n.workspaceId ?? null,
    projectId: n.projectId ?? null,
  };
}

export interface UseNotificationsOptions {
  onIncoming?: (notification: IncomingNotification) => void;
}

export function useNotifications(
  _workspaceId?: string | null,
  enabled = true,
  options?: UseNotificationsOptions,
): {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  /** Message from the last failed load, or null when the last load succeeded. */
  error: string | null;
  refresh: () => void;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
} {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Apply an optimistic update to a single notification locally, then sync with
  // the server. On failure the change is reverted and the next poll reconciles.
  const patchNotification = useCallback((id: string, patch: Partial<AppNotification>) => {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    );
  }, []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await getNotifications({ pageSize: MAX_ITEMS });
      setNotifications(result.items.map(fromApi));
      setError(null);
    } catch (err) {
      // If the API fails (e.g. offline), keep the last known list and let the
      // 60s poll recover. Never fabricate notifications from activities. The
      // error is surfaced (not swallowed) so a first-load failure renders as
      // an error instead of a fake-empty list.
      setError(err instanceof Error ? err.message : t("notification.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [enabled, t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const incomingRef = useRef(options?.onIncoming);
  incomingRef.current = options?.onIncoming;

  useEffect(() => {
    if (!enabled) return;
    const connection = getNotificationConnection();
    const handleIncoming = (payload: unknown) => {
      loadRef.current();
      incomingRef.current?.(parseNotificationPayload(payload));
    };
    connection.on("notification", handleIncoming);
    void startNotificationStream();
    return () => {
      connection.off("notification", handleIncoming);
      stopNotificationStream();
    };
  }, [enabled]);

  const markRead = useCallback(
    (id: string) => {
      patchNotification(id, { isRead: true });
      void markReadApi(id).catch(() => {
        patchNotification(id, { isRead: false });
      });
    },
    [patchNotification],
  );

  const markUnread = useCallback(
    (id: string) => {
      patchNotification(id, { isRead: false });
      void markUnreadApi(id).catch(() => {
        patchNotification(id, { isRead: true });
      });
    },
    [patchNotification],
  );

  const markAllRead = useCallback(() => {
    setNotifications((current) =>
      current.map((n) => (n.isRead ? n : { ...n, isRead: true })),
    );
    void markAllReadApi().catch(() => void loadRef.current());
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: () => void load(),
    markRead,
    markUnread,
    markAllRead,
  };
}
