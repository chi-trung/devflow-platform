import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  getNotifications,
  markAllNotificationsRead as markAllReadApi,
  markNotificationRead as markReadApi,
} from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import type {
  ActivityResponse,
  NotificationResponse,
  ProjectResponse,
} from "../types/api";

const READ_KEY = "devflow.readNotificationIds";
const MAX_ITEMS = 20;

export interface AppNotification {
  id: string;
  message: string;
  actorName: string | null;
  createdAtUtc: string;
  kind: "comment" | "sprint" | "task" | "other";
  taskId: string | null;
  workspaceId: string | null;
  projectId: string | null;
}

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {}
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
    message: n.message,
    actorName: null,
    createdAtUtc: n.createdAtUtc,
    kind: kindFromText(n.type || n.message),
    taskId: n.taskId ?? null,
    workspaceId: n.workspaceId ?? null,
    projectId: n.projectId ?? null,
  };
}

function fromActivity(
  activity: ActivityResponse,
  workspaceId: string,
  projectId: string,
): AppNotification {
  const message = activity.target
    ? `${activity.actorName} ${activity.action} "${activity.target}"`
    : `${activity.actorName} ${activity.action}`;
  return {
    id: `act-${activity.id}`,
    message,
    actorName: activity.actorName,
    createdAtUtc: activity.createdAtUtc,
    kind: kindFromText(activity.action),
    taskId: activity.taskItemId,
    workspaceId,
    projectId,
  };
}

async function fetchActivityNotifications(workspaceId: string) {
  const projects = await api<ProjectResponse[]>(
    `/workspaces/${workspaceId}/projects`,
  );
  const lists = await Promise.all(
    projects.map((project) =>
      api<ActivityResponse[]>(
        `/workspaces/${workspaceId}/projects/${project.id}/activities`,
      ).catch(() => [] as ActivityResponse[]),
    ),
  );
  return lists.flatMap((activities, index) =>
    activities.map((activity) =>
      fromActivity(activity, workspaceId, projects[index].id),
    ),
  );
}

export function useNotifications(
  workspaceId?: string | null,
  enabled = true,
): {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  readIds: Set<string>;
  refresh: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
} {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const modeRef = useRef<"api" | "activities" | null>(null);
  const { currentUser } = useAuth();
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      let data: AppNotification[];
      if (modeRef.current === "activities") {
        data = workspaceId
          ? await fetchActivityNotifications(workspaceId)
          : [];
      } else {
        data = (await getNotifications()).map(fromApi);
        modeRef.current = "api";
      }
      setNotifications(data.slice(0, MAX_ITEMS));
    } catch {
      modeRef.current = "activities";
      try {
        const data = workspaceId
          ? await fetchActivityNotifications(workspaceId)
          : [];
        setNotifications(
          data
            .filter(
              (n) =>
                !currentUserRef.current ||
                (n.actorName !== currentUserRef.current.username &&
                  n.actorName !== currentUserRef.current.email),
            )
            .sort(
              (a, b) =>
                new Date(b.createdAtUtc).getTime() -
                new Date(a.createdAtUtc).getTime(),
            )
            .slice(0, MAX_ITEMS),
        );
      } catch {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, workspaceId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((current) => {
        const next = new Set(current).add(id);
        persistReadIds(next);
        return next;
      });
      if (modeRef.current === "api") {
        void markReadApi(id).catch(() => {});
      }
    },
    [],
  );

  const markAllRead = useCallback(() => {
    setReadIds((current) => {
      const next = new Set(current);
      for (const n of notifications) next.add(n.id);
      persistReadIds(next);
      return next;
    });
    if (modeRef.current === "api") {
      void markAllReadApi().catch(() => {});
    }
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds],
  );

  return {
    notifications,
    unreadCount,
    loading,
    readIds,
    refresh: () => void load(),
    markRead,
    markAllRead,
  };
}
