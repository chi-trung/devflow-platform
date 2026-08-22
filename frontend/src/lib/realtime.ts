import * as signalR from "@microsoft/signalr";
import { API_BASE, tokens } from "./api";

export function createProjectConnection(): signalR.HubConnection {
  return new signalR.HubConnectionBuilder()
    .withUrl(`${API_BASE}/hubs/projects`, {
      accessTokenFactory: () => tokens.access ?? "",
    })
    .withAutomaticReconnect()
    .build();
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
      .withUrl(`${API_BASE}/hubs/notifications`, {
        accessTokenFactory: () => tokens.access ?? "",
      })
      .withAutomaticReconnect()
      .build();
  }
  return notificationConnection;
}

export async function startNotificationStream(): Promise<void> {
  const connection = getNotificationConnection();
  if (connection.state !== signalR.HubConnectionState.Disconnected) return;
  try {
    await connection.start();
  } catch {
    // the polling fallback in useNotifications keeps the UI working without realtime
  }
}

export function stopNotificationStream(): void {
  if (!notificationConnection) return;
  if (notificationConnection.state === signalR.HubConnectionState.Disconnected)
    return;
  void notificationConnection.stop().catch(() => {});
}

export function resetNotificationStream(): void {
  stopNotificationStream();
  notificationConnection = null;
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
