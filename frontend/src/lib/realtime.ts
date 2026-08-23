import * as signalR from "@microsoft/signalr";
import { API_BASE, tokens } from "./api";

// Keepalive below typical proxy idle timeouts (Render/Vercel edge) so
// idle WebSockets are not dropped mid-session.
const HUB_OPTIONS = {
  accessTokenFactory: () => tokens.access ?? "",
  keepAliveIntervalInMilliseconds: 15_000,
  serverTimeoutInMilliseconds: 60_000,
};

const RECONNECT_DELAYS = [0, 2_000, 5_000, 10_000, 30_000, 60_000];

export function createProjectConnection(
  projectId?: string,
): signalR.HubConnection {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/projects`, HUB_OPTIONS)
    .withAutomaticReconnect(RECONNECT_DELAYS)
    .build();

  // After an automatic reconnect the connection has rejoined no groups;
  // re-invoke JoinProject so live updates keep flowing.
  connection.onreconnected(() => {
    if (projectId) {
      void connection.invoke("JoinProject", projectId).catch(() => {});
    }
  });

  return connection;
}

// ── Online/wake guards ──────────────────────────────────────────────
// Long outages exhaust the automatic reconnect schedule (state becomes
// Disconnected). When connectivity returns we let listeners restart
// connections and refetch.
const wakeListeners = new Set<() => void>();

/** Register a callback fired when connectivity returns. Returns unlisten. */
export function onConnectionWake(listener: () => void): () => void {
  wakeListeners.add(listener);
  return () => wakeListeners.delete(listener);
}

function notifyWake(): void {
  for (const listener of [...wakeListeners]) {
    try {
      listener();
    } catch {}
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    notifyWake();
    void restartNotificationStreamIfOwned();
  });
}

export interface IncomingNotification {
  type: string | null;
  message: string | null;
  taskId: string | null;
  projectId: string | null;
  workspaceId: string | null;
}

let notificationConnection: signalR.HubConnection | null = null;

export function getNotificationConnection(): signalR.HubConnection {
  if (!notificationConnection) {
    notificationConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/notifications`, HUB_OPTIONS)
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .build();
  }
  return notificationConnection;
}

let notificationSubscribers = 0;
let stopTimer: number | null = null;
let startingPromise: Promise<void> | null = null;

export async function startNotificationStream(): Promise<void> {
  notificationSubscribers++;
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }

  const connection = getNotificationConnection();
  if (connection.state === signalR.HubConnectionState.Connected) return;
  if (startingPromise) {
    return startingPromise;
  }

  if (connection.state === signalR.HubConnectionState.Disconnected) {
    startingPromise = connection
      .start()
      .catch(() => {
        // the polling fallback in useNotifications keeps the UI working without realtime
      })
      .finally(() => {
        startingPromise = null;
      });
    return startingPromise;
  }
}

export function stopNotificationStream(): void {
  notificationSubscribers = Math.max(0, notificationSubscribers - 1);
  if (notificationSubscribers > 0) return;

  if (stopTimer !== null) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(async () => {
    stopTimer = null;
    if (notificationSubscribers > 0) return;
    if (startingPromise) {
      try {
        await startingPromise;
      } catch {}
    }
    if (
      notificationConnection &&
      notificationConnection.state !== signalR.HubConnectionState.Disconnected
    ) {
      try {
        await notificationConnection.stop();
      } catch {}
    }
  }, 1000);
}

export function resetNotificationStream(): void {
  notificationSubscribers = 0;
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (notificationConnection) {
    void notificationConnection.stop().catch(() => {});
    notificationConnection = null;
  }
}

/** Used by the online guard: restart the stream if this app still wants it. */
async function restartNotificationStreamIfOwned(): Promise<void> {
  if (notificationSubscribers <= 0) return;
  const connection = getNotificationConnection();
  if (
    connection.state === signalR.HubConnectionState.Disconnected &&
    navigator.onLine
  ) {
    await startNotificationStream().catch(() => {});
  }
}

export function parseNotificationPayload(
  payload: unknown,
): IncomingNotification {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const str = (value: unknown): string | null =>
    typeof value === "string" && value.trim().length > 0 ? value : null;

  return {
    type: str(record.type) ?? str(data.type),
    message: str(data.message) ?? str(record.message),
    taskId: str(data.taskId) ?? str(data.taskItemId),
    projectId: str(data.projectId),
    workspaceId: str(data.workspaceId),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
