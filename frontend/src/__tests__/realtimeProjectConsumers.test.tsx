import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Wave-37 consumer probe. The shared project socket is owned by realtime.ts
// and only released — never stopped — by its consumers. usePresence shares one
// connection with BoardPage's live-update effect; before the fix either
// consumer's cleanup called stopProjectConnection directly, so whoever
// unmounted first closed the socket the other one was still using. On the
// board that made this user disappear from everyone else's presence
// (ProjectHub broadcasts user-left on disconnect) and live updates stopped,
// while the tab was still open.

vi.mock("@microsoft/signalr", () => {
  let counter = 0;
  return {
    HubConnectionBuilder: class {
      withUrl() {
        return this;
      }
      withAutomaticReconnect() {
        return this;
      }
      build() {
        counter += 1;
        return {
          id: `conn-${counter}`,
          state: "Disconnected",
          stopped: false,
          invoked: [] as string[],
          on() {},
          off() {},
          async start() {
            this.state = "Connected";
          },
          async stop() {
            this.stopped = true;
            this.state = "Disconnected";
          },
          async invoke(method: string) {
            this.invoked.push(method);
          },
          onreconnected() {
            return this;
          },
        };
      }
    },
    HubConnectionState: { Connected: "Connected", Disconnected: "Disconnected" },
  };
});

import { usePresence } from "../hooks/usePresence";
import {
  createProjectConnection,
  resetProjectConnections,
} from "../lib/realtime";

type FakeConnection = {
  id: string;
  state: string;
  stopped: boolean;
};

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("shared project hub consumers do not stop each other's socket (wave-37)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProjectConnections();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    resetProjectConnections();
  });

  it("unmounting one consumer leaves the connection live for the other", async () => {
    // Two consumers of the same board's socket: usePresence and BoardPage's
    // live-update effect (modelled here by a second usePresence).
    const a = renderHook(() => usePresence("project-1", [], "user-a"));
    const b = renderHook(() => usePresence("project-1", [], "user-b"));
    await flush();

    const conn = createProjectConnection("project-1") as unknown as FakeConnection;
    expect(conn.stopped).toBe(false);
    expect(conn.state).toBe("Connected");

    // BoardPage's effect tears down first (it mounts last, so it cleans up
    // first). It must not stop the socket usePresence still relies on.
    b.unmount();
    vi.advanceTimersByTime(1_000);
    await flush();

    expect(conn.stopped).toBe(false);
    expect(conn.state).toBe("Connected");

    a.unmount();
    vi.advanceTimersByTime(1_000);
    await flush();

    // Only now, with every consumer gone, does the socket stop.
    expect(conn.stopped).toBe(true);
  });

  it("separate projects keep independent sockets when one board unmounts", async () => {
    const a = renderHook(() => usePresence("project-a", [], "user-a"));
    renderHook(() => usePresence("project-b", [], "user-b"));
    await flush();

    const connB = createProjectConnection("project-b") as unknown as FakeConnection;

    a.unmount();
    vi.advanceTimersByTime(1_000);
    await flush();

    expect(connB.stopped).toBe(false);
    expect(connB.state).toBe("Connected");
  });
});
