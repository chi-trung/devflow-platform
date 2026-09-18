import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Wave-38 consumer probe. AppShell and WorkspacePage both call
// useWorkspaceEvents with the SAME workspace id while a workspace page is
// open, so the singleton notification socket ends up subscribed to that
// workspace's group twice. Whichever consumer unmounted first used to call
// unjoinWorkspaceGroup and delete the membership the other consumer still
// relied on — and the socket's onreconnected handler re-joins from that same
// set, so after any transient drop the surviving consumer silently stopped
// receiving workspace events until a manual F5.

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

import { useWorkspaceEvents } from "../hooks/useWorkspaceEvents";
import {
  getNotificationConnection,
  resetNotificationStream,
  workspaceGroupSubscribers,
} from "../lib/realtime";

type FakeConnection = {
  reconnectHandler: (() => void) | null;
  invoked: string[];
};

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("workspace-event consumers keep the group join for each other (wave-38)", () => {
  beforeEach(() => {
    resetNotificationStream();
  });
  afterEach(() => {
    resetNotificationStream();
  });

  it("unmounting one consumer leaves the other subscribed", async () => {
    // AppShell mounts first and outlives WorkspacePage, but the contract must
    // hold in either ordering — model the workspace-page pair directly.
    const shell = renderHook(() =>
      useWorkspaceEvents("ws-1", () => undefined),
    );
    const page = renderHook(() =>
      useWorkspaceEvents("ws-1", () => undefined),
    );
    await flush();
    expect(workspaceGroupSubscribers("ws-1")).toBe(2);

    // WorkspacePage unmounts (route change away, still inside the workspace).
    page.unmount();
    expect(workspaceGroupSubscribers("ws-1")).toBe(1);

    // AppShell is still subscribed, so the socket must still re-join this
    // workspace's group after a transport reconnect.
    const conn = getNotificationConnection() as unknown as FakeConnection;
    conn.invoked.length = 0;
    conn.reconnectHandler!();
    await flush();
    expect(conn.invoked).toContain("JoinWorkspace:ws-1");

    shell.unmount();
    expect(workspaceGroupSubscribers("ws-1")).toBeUndefined();
  });

  it("a stray release does not unsubscribe a live consumer", () => {
    const shell = renderHook(() =>
      useWorkspaceEvents("ws-1", () => undefined),
    );
    expect(workspaceGroupSubscribers("ws-1")).toBe(1);

    // A consumer that never joined (different effect ordering / guard path)
    // must not drive the count below zero and drop the real subscription.
    const stray = renderHook(() =>
      useWorkspaceEvents("ws-2", () => undefined),
    );
    stray.unmount();
    expect(workspaceGroupSubscribers("ws-1")).toBe(1);

    shell.unmount();
  });
});
