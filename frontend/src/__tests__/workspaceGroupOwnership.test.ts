import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Wave-38: the notification hub's workspace-group membership is ref-counted.
// AppShell and WorkspacePage both call useWorkspaceEvents with the same
// workspace id while a workspace page is open, so the singleton socket ends
// up subscribed twice. Before the ref-count, whichever consumer unmounted
// first called unjoinWorkspaceGroup and deleted the group membership the
// other consumer still depended on — and the onreconnected handler re-joins
// from this map, so after any transient reconnect the surviving consumer
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
          async start() {
            this.state = "Connected";
          },
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
  workspaceGroupSubscribers,
  resetNotificationStream,
} from "../lib/realtime";

type FakeConnection = {
  reconnectHandler: (() => void) | null;
  invoked: string[];
};

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("workspace group membership is ref-counted (wave-38)", () => {
  beforeEach(() => {
    resetNotificationStream();
  });
  afterEach(() => {
    resetNotificationStream();
  });

  it("an early unmount does not drop the membership the other consumer holds", async () => {
    // AppShell + WorkspacePage both subscribe to the open workspace.
    joinWorkspaceGroup("ws-1");
    joinWorkspaceGroup("ws-1");

    // AppShell's effect tears down first (it mounts first, so React cleans it
    // up last — either ordering must be safe).
    unjoinWorkspaceGroup("ws-1");
    expect(workspaceGroupSubscribers("ws-1")).toBe(1);

    // WorkspacePage still relies on the join, so the socket must still be a
    // member — proved via the reconnect path, which re-joins from this map.
    const conn = getNotificationConnection() as unknown as FakeConnection;
    conn.invoked.length = 0;
    conn.reconnectHandler!();
    await flush();
    expect(conn.invoked).toContain("JoinWorkspace:ws-1");

    // The last consumer drops it.
    unjoinWorkspaceGroup("ws-1");
    expect(workspaceGroupSubscribers("ws-1")).toBeUndefined();

    conn.invoked.length = 0;
    conn.reconnectHandler!();
    await flush();
    expect(conn.invoked).not.toContain("JoinWorkspace:ws-1");
  });

  it("ref-counts per workspace: releasing one workspace leaves the other joined", async () => {
    joinWorkspaceGroup("ws-a");
    joinWorkspaceGroup("ws-b");

    unjoinWorkspaceGroup("ws-a");
    expect(workspaceGroupSubscribers("ws-a")).toBeUndefined();
    expect(workspaceGroupSubscribers("ws-b")).toBe(1);

    const conn = getNotificationConnection() as unknown as FakeConnection;
    conn.invoked.length = 0;
    conn.reconnectHandler!();
    await flush();
    expect(conn.invoked).not.toContain("JoinWorkspace:ws-a");
    expect(conn.invoked).toContain("JoinWorkspace:ws-b");
  });

  it("redundant joins accumulate and each needs its own release", () => {
    joinWorkspaceGroup("ws-1");
    joinWorkspaceGroup("ws-1");
    joinWorkspaceGroup("ws-1");

    unjoinWorkspaceGroup("ws-1");
    unjoinWorkspaceGroup("ws-1");
    expect(workspaceGroupSubscribers("ws-1")).toBe(1);

    unjoinWorkspaceGroup("ws-1");
    expect(workspaceGroupSubscribers("ws-1")).toBeUndefined();
  });

  it("an unpaired release never drives the count negative", () => {
    unjoinWorkspaceGroup("never-joined");
    expect(workspaceGroupSubscribers("never-joined")).toBeUndefined();

    // The workspace is still joinable after the stray release.
    joinWorkspaceGroup("never-joined");
    expect(workspaceGroupSubscribers("never-joined")).toBe(1);
  });
});
