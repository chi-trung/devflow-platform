import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Workspace-group rejoin probe (wave-36 follow-up). NotificationHub sends
// "workspace-event" to Clients.Group($"workspace:{id}") (NotificationHub.cs),
// and SignalR runs a fresh handshake on every automatic reconnect — new
// connectionId, and ASP.NET Core hub groups are keyed by connection id, so the
// membership is gone. useWorkspaceEvents used to claim "after a reconnect the
// join is re-issued by the connection's onreconnected handler", but no such
// handler existed: after any transient drop, AppShell and WorkspacePage
// silently stopped receiving workspace events until a manual F5.

vi.mock("@microsoft/signalr", () => {
  return {
    HubConnectionBuilder: class {
      withUrl() {
        return this;
      }
      withAutomaticReconnect() {
        return this;
      }
      build() {
        return {
          state: "Disconnected",
          reconnectHandler: null as (() => void) | null,
          invoked: [] as string[],
          on() {},
          off() {},
          async start() {},
          async stop() {},
          async invoke(method: string, arg?: string) {
            this.invoked.push(arg === undefined ? method : `${method}:${arg}`);
          },
          onreconnected(handler: () => void) {
            this.reconnectHandler = handler;
            return this;
          },
        };
      }
    },
    HubConnectionState: { Connected: "Connected", Disconnected: "Disconnected" },
  };
});

import {
  getNotificationConnection,
  joinWorkspaceGroup,
  unjoinWorkspaceGroup,
  resetNotificationStream,
} from "../lib/realtime";

type FakeConnection = {
  reconnectHandler: (() => void) | null;
  invoked: string[];
};

function conn(): FakeConnection {
  return getNotificationConnection() as unknown as FakeConnection;
}

describe("notification hub rejoins workspace groups after a reconnect (wave-36)", () => {
  beforeEach(() => {
    resetNotificationStream();
  });
  afterEach(() => {
    resetNotificationStream();
  });

  it("re-issues JoinWorkspace for a joined group on reconnect", async () => {
    joinWorkspaceGroup("ws-1");
    expect(conn().invoked).not.toContain("JoinWorkspace:ws-1");

    // Simulate a transport reconnect: fresh handshake, old group membership gone.
    conn().reconnectHandler!();
    await Promise.resolve();
    expect(conn().invoked).toContain("JoinWorkspace:ws-1");
  });

  it("does not rejoin a group the consumer unmounted from", async () => {
    joinWorkspaceGroup("ws-1");
    unjoinWorkspaceGroup("ws-1");
    conn().reconnectHandler!();
    await Promise.resolve();
    expect(conn().invoked).not.toContain("JoinWorkspace:ws-1");
  });

  it("registers the reconnect handler only once per connection", () => {
    const a = conn();
    const b = conn();
    expect(a).toBe(b);
    expect(a.reconnectHandler).not.toBeNull();
  });
});
