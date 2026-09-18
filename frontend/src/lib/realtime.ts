import * as signalR from "@microsoft/signalr";
import { API_BASE, fetchHubTicket, tokens } from "./api";

// Keepalive below typical proxy idle timeouts (Render/Vercel edge) so
// idle WebSockets are not dropped mid-session.
//
// The token sent here is a one-time, 90s hub ticket (not the long-lived
// JWT): accessTokenFactory runs on every (re)connect and negotiates, so it
// fetches a fresh ticket each time. If the exchange fails the legacy JWT is
// sent instead — the backend still accepts it during the deploy window.
const HUB_OPTIONS = {
  accessTokenFactory: async () => (await fetchHubTicket()) ?? tokens.access ?? "",
  keepAliveIntervalInMilliseconds: 15_000,
  serverTimeoutInMilliseconds: 60_000,
};

const RECONNECT_DELAYS = [0, 2_000, 5_000, 10_000, 30_000, 60_000];

// `connection.stop()` racing an in-flight `.start()` (or an automatic
// reconnect) makes @microsoft/signalr throw "Failed to start the
// HttpConnection before stop() was called." — benign, but it spams the
// console on every server restart. The fix: track each connection's in-flight
// start, never start twice, and await any pending start before stopping.
const starting = new WeakMap<signalR.HubConnection, Promise<void>>();

// ── Project hub: one connection per project, shared ─────────────────
// Two consumers open on the same board (BoardPage's live-update effect and
// usePresence) used to call createProjectConnection separately, so every
// board tab held TWO ProjectHub connections in the same project group.
// The hub broadcasts to OthersInGroup, so a duplicate connection made every
// remote board user's events arrive twice, and made the same user appear
// twice in everyone's presence list (two join broadcasts, two connection
// ids). Ref-counting collapses both consumers onto one socket.
const projectConnections = new Map<string, signalR.HubConnection>();
// Ref-count PER PROJECT: a board holds one shared socket for its project, and
// each of its consumers (BoardPage's live-update effect, usePresence) owns one
// ref. A global counter would let a release of project A tear down project B.
const projectSubscribers = new Map<string, number>();
const projectStopTimers = new Map<string, number>();

/**
 * Return the single shared project-hub connection for this project, starting
 * it if needed. The connection is NOT stopped when the caller is done — see
 * {@link releaseProjectConnection}, which only stops once the last consumer
 * drops it (after a short delay so a rapid unmount/remount does not churn
 * the socket).
 *
 * Pass {@link createUnjoinedProjectConnection} for a consumer that wants its
 * own socket outside the shared map (it still re-joins its group after a
 * reconnect).
 */
export function createProjectConnection(
  projectId?: string,
): signalR.HubConnection {
  if (!projectId) {
    // Untyped callers still get a connection; it simply joins no group.
    return new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/projects`, HUB_OPTIONS)
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .build();
  }
  const existing = projectConnections.get(projectId);
  if (existing) return existing;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/projects`, HUB_OPTIONS)
    .withAutomaticReconnect(RECONNECT_DELAYS)
    .build();

  // After an automatic reconnect the connection has rejoined no groups;
  // re-invoke JoinProject so live updates keep flowing.
  connection.onreconnected(() => {
    void connection.invoke("JoinProject", projectId).catch(() => {});
  });

  projectConnections.set(projectId, connection);
  return connection;
}

/**
 * A project-hub connection that lives OUTSIDE the shared map: the caller owns
 * its own socket and stops it itself. Used by SprintPlanningPage, which never
 * shares a project with BoardPage but still needs to re-join the project group
 * after an automatic reconnect (SignalR drops group membership on reconnect).
 */
export function createUnjoinedProjectConnection(
  projectId?: string,
): signalR.HubConnection {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/projects`, HUB_OPTIONS)
    .withAutomaticReconnect(RECONNECT_DELAYS)
    .build();
  if (projectId) {
    connection.onreconnected(() => {
      void connection.invoke("JoinProject", projectId).catch(() => {});
    });
  }
  return connection;
}

/**
 * Register a consumer of the shared project connection for this project. Must
 * be paired with {@link releaseProjectConnection} in an effect cleanup.
 *
 * Callers that hold this project's socket — BoardPage's live-update effect and
 * usePresence on the same board — each retain once; the socket is only stopped
 * once the last one for THIS project releases it. Stopping directly (instead of
 * releasing) would close the other consumer's connection mid-session.
 */
export function retainProjectConnection(projectId: string): void {
  projectSubscribers.set(projectId, (projectSubscribers.get(projectId) ?? 0) + 1);
  const timer = projectStopTimers.get(projectId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    projectStopTimers.delete(projectId);
  }
}

/**
 * Drop a consumer. The socket is only stopped once the last consumer for this
 * project is gone — and after 1s, so a remount (React strict mode, a route hop
 * and back) reuses the warm connection instead of tearing a WebSocket down
 * and up.
 */
export async function releaseProjectConnection(
  projectId: string,
): Promise<void> {
  const remaining = Math.max(0, (projectSubscribers.get(projectId) ?? 0) - 1);
  if (remaining > 0) {
    projectSubscribers.set(projectId, remaining);
    return;
  }
  projectSubscribers.delete(projectId);

  const pending = projectStopTimers.get(projectId);
  if (pending !== undefined) window.clearTimeout(pending);
  projectStopTimers.set(
    projectId,
    window.setTimeout(async () => {
      projectStopTimers.delete(projectId);
      if (projectSubscribers.has(projectId)) return;
      const connection = projectConnections.get(projectId);
      if (connection) {
        await stopProjectConnection(connection).catch(() => {});
        projectConnections.delete(projectId);
      }
    }, 1000),
  );
}

/**
 * Reset all project connections (tests / explicit teardown).
 */
export function resetProjectConnections(): void {
  for (const timer of projectStopTimers.values()) {
    window.clearTimeout(timer);
  }
  projectStopTimers.clear();
  projectSubscribers.clear();
  for (const connection of projectConnections.values()) {
    void stopProjectConnection(connection);
  }
  projectConnections.clear();
}

/**
 * Start a hub connection exactly once, guarding against re-entry and against
 * `stop()` racing an in-flight start (the @microsoft/signalr
 * "Failed to start the HttpConnection before stop() was called" error).
 */
export async function startHubConnection(
  connection: signalR.HubConnection,
): Promise<void> {
  if (connection.state === signalR.HubConnectionState.Connected) return;

  let pending = starting.get(connection);
  if (pending) {
    await pending;
    return;
  }

  pending = (async () => {
    try {
      await connection.start();
    } catch {
      // connection-level fallback: callers keep working without realtime
    } finally {
      starting.delete(connection);
    }
  })();
  starting.set(connection, pending);
  await pending;
}

/**
 * Start a project hub connection and join the project group. Safe against
 * re-entry: a start already in flight is awaited, not duplicated.
 */
export async function startProjectConnection(
  connection: signalR.HubConnection,
  projectId: string,
): Promise<void> {
  await startHubConnection(connection);
  if (connection.state === signalR.HubConnectionState.Connected && projectId) {
    await connection.invoke("JoinProject", projectId).catch(() => {});
  }
}

/**
 * Stop a hub connection without racing an in-flight start. Safe to call
 * from an unmount/cleanup even if a start is still pending.
 */
export async function stopProjectConnection(
  connection: signalR.HubConnection,
): Promise<void> {
  const pending = starting.get(connection);
  if (pending) {
    try {
      await pending;
    } catch {}
  }
  if (connection.state !== signalR.HubConnectionState.Disconnected) {
    try {
      await connection.stop();
    } catch {}
  }
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

// Workspaces whose workspace-event group the connection should be a member
// of. SignalR runs a fresh handshake on every automatic reconnect (new
// connectionId) and ASP.NET Core hub groups are keyed by connection id, so
// membership is lost; this set is re-joined from onreconnected.
// Workspaces whose workspace-event group the connection should be a member
// of. SignalR runs a fresh handshake on every automatic reconnect (new
// connectionId) and ASP.NET Core hub groups are keyed by connection id, so
// membership is lost; this map is re-joined from onreconnected. The value is
// a ref-count — AppShell and WorkspacePage both join the same workspace while
// it is open, so the first to unmount must not drop the other's membership.
const joinedWorkspaces = new Map<string, number>();

export function getNotificationConnection(): signalR.HubConnection {
  if (!notificationConnection) {
    notificationConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE}/hubs/notifications`, HUB_OPTIONS)
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .build();
    notificationConnection.onreconnected(() => {
      for (const workspaceId of joinedWorkspaces.keys()) {
        void notificationConnection
          ?.invoke("JoinWorkspace", workspaceId)
          .catch(() => {});
      }
    });
  }
  return notificationConnection;
}

/**
 * Remember that this connection wants `workspace:{id}` events, so the
 * membership can be re-established after an automatic reconnect. Paired with
 * {@link unjoinWorkspaceGroup} from the same effect that called it.
 *
 * The join is REF-COUNTED: AppShell and WorkspacePage both subscribe while a
 * workspace is open, so the consumer that unmounts first must not drop the
 * membership the other one still relies on. The group is only left when the
 * last consumer for that workspace releases it.
 */
export function joinWorkspaceGroup(workspaceId: string): void {
  joinedWorkspaces.set(
    workspaceId,
    (joinedWorkspaces.get(workspaceId) ?? 0) + 1,
  );
}

export function unjoinWorkspaceGroup(workspaceId: string): void {
  const remaining = Math.max(0, (joinedWorkspaces.get(workspaceId) ?? 0) - 1);
  if (remaining > 0) {
    joinedWorkspaces.set(workspaceId, remaining);
    return;
  }
  joinedWorkspaces.delete(workspaceId);
}

let notificationSubscribers = 0;
let stopTimer: number | null = null;

export async function startNotificationStream(): Promise<void> {
  notificationSubscribers++;
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }

  const connection = getNotificationConnection();
  if (connection.state !== signalR.HubConnectionState.Connected) {
    await startHubConnection(connection).catch(() => {
      // the polling fallback in useNotifications keeps the UI working without realtime
    });
  }
}

export function stopNotificationStream(): void {
  notificationSubscribers = Math.max(0, notificationSubscribers - 1);
  if (notificationSubscribers > 0) return;

  if (stopTimer !== null) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(async () => {
    stopTimer = null;
    if (notificationSubscribers > 0) return;
    if (notificationConnection) {
      await stopProjectConnection(notificationConnection).catch(() => {});
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
    void stopProjectConnection(notificationConnection);
    notificationConnection = null;
  }
  // The socket is gone, so its group memberships cannot outlive it.
  joinedWorkspaces.clear();
}

/**
 * Test helper: how many consumers currently hold this workspace's group join.
 * Undefined when no consumer has joined it.
 */
export function workspaceGroupSubscribers(workspaceId: string): number | undefined {
  return joinedWorkspaces.get(workspaceId);
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
