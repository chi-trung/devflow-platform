import { useEffect } from "react";
import * as signalR from "@microsoft/signalr";
import {
  getNotificationConnection,
  joinWorkspaceGroup,
  startNotificationStream,
  stopNotificationStream,
  unjoinWorkspaceGroup,
} from "../lib/realtime";

export interface WorkspaceEventPayload {
  eventType: string | null;
  workspaceId: string | null;
}

/**
 * Subscribes to realtime workspace events ("workspace-event" on the
 * notification hub) and calls `onEvent` when one arrives — used to refresh
 * workspace/project lists without a manual F5. Shares the singleton
 * notification stream with useNotifications (refcounted), so mounting this
 * alongside it costs nothing extra.
 *
 * The subscription is always active so events reach the client on any route
 * (e.g. the dashboard watching for a workspace created elsewhere). When
 * `workspaceId` is given it also joins that workspace's group so events for
 * the workspace being viewed are received; the join is registered with
 * realtime.ts so it survives an automatic reconnect, which drops group
 * membership.
 */
export function useWorkspaceEvents(
  workspaceId?: string | null,
  onEvent?: (payload: WorkspaceEventPayload) => void,
): void {
  useEffect(() => {
    const connection = getNotificationConnection();
    const handleEvent = (payload: unknown) => {
      const record =
        typeof payload === "object" && payload !== null
          ? (payload as Record<string, unknown>)
          : {};
      onEvent?.({
        eventType:
          typeof record.eventType === "string" ? record.eventType : null,
        workspaceId:
          typeof record.workspaceId === "string"
            ? record.workspaceId
            : null,
      });
    };
    connection.on("workspace-event", handleEvent);
    if (workspaceId) joinWorkspaceGroup(workspaceId);
    void startNotificationStream().then(() => {
      if (
        workspaceId &&
        connection.state === signalR.HubConnectionState.Connected
      ) {
        void connection.invoke("JoinWorkspace", workspaceId).catch(() => {});
      }
    });
    return () => {
      connection.off("workspace-event", handleEvent);
      if (workspaceId) unjoinWorkspaceGroup(workspaceId);
      stopNotificationStream();
    };
  }, [workspaceId, onEvent]);
}
