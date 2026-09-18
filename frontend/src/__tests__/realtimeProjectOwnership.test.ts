import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Wave-37: the shared ProjectHub socket is ref-counted PER PROJECT, and shared
// consumers (BoardPage's live-update effect + usePresence) must release it
// rather than stopping it directly. Before this, either consumer unmounting
// first called stopProjectConnection itself, closing the socket the other one
// was still using — the board's user vanished from everyone else's presence
// (ProjectHub broadcasts user-left on disconnect) and live updates stopped,
// even though that user was still on the board.

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
          // Minimal: the ownership contract lives in realtime.ts, not here.
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

import {
  createProjectConnection,
  retainProjectConnection,
  releaseProjectConnection,
  resetProjectConnections,
  startProjectConnection,
} from "../lib/realtime";

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("shared project hub ownership (wave-37)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProjectConnections();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    resetProjectConnections();
  });

  it("an early unmount does not stop the connection the other consumer holds", async () => {
    const conn = createProjectConnection("project-1");
    await startProjectConnection(conn, "project-1");
    const stop = vi.spyOn(conn, "stop");

    // BoardPage + usePresence each retain once for this project.
    retainProjectConnection("project-1");
    retainProjectConnection("project-1");

    // BoardPage unmounts first (e.g. its effect cleanup ordering).
    await releaseProjectConnection("project-1");
    expect(stop).not.toHaveBeenCalled();

    // usePresence is still mounted, so the socket must still be live.
    expect(conn.state).toBe("Connected");

    vi.advanceTimersByTime(1_000);
    await flush();
    // No stop was ever scheduled while a consumer still held it.
    expect(stop).not.toHaveBeenCalled();

    // The last consumer drops it.
    await releaseProjectConnection("project-1");
    expect(stop).not.toHaveBeenCalled(); // deferred, not eager

    vi.advanceTimersByTime(1_000);
    await flush();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("ref-counts per project: releasing project A leaves project B's socket live", async () => {
    const a = createProjectConnection("project-a");
    const b = createProjectConnection("project-b");
    await startProjectConnection(a, "project-a");
    await startProjectConnection(b, "project-b");
    const stopA = vi.spyOn(a, "stop");
    const stopB = vi.spyOn(b, "stop");

    retainProjectConnection("project-a");
    retainProjectConnection("project-b");

    await releaseProjectConnection("project-a");
    vi.advanceTimersByTime(1_000);
    await flush();

    // A is fully released and torn down; B is untouched.
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).not.toHaveBeenCalled();
    expect(b.state).toBe("Connected");

    // A late retain of A after teardown starts a fresh socket, not B's.
    const reused = createProjectConnection("project-a");
    expect(reused).not.toBe(b);
  });

  it("a remount during the stop delay reuses the warm connection", async () => {
    const conn = createProjectConnection("project-1");
    await startProjectConnection(conn, "project-1");
    const stop = vi.spyOn(conn, "stop");

    retainProjectConnection("project-1");
    await releaseProjectConnection("project-1");

    // Strict-mode double invoke / route hop and back re-retains within the delay.
    retainProjectConnection("project-1");
    vi.advanceTimersByTime(1_000);
    await flush();

    expect(stop).not.toHaveBeenCalled();
    expect(createProjectConnection("project-1")).toBe(conn);
  });

  it("a leaked retain on one project does not pin or tear down another", async () => {
    // Consumers are ref-counted per project, so an unpaired retain/release on
    // project A must neither keep project B's socket alive nor stop it.
    const a = createProjectConnection("project-a");
    const b = createProjectConnection("project-b");
    await startProjectConnection(a, "project-a");
    await startProjectConnection(b, "project-b");
    const stopA = vi.spyOn(a, "stop");
    const stopB = vi.spyOn(b, "stop");

    retainProjectConnection("project-a"); // leaked — never released
    retainProjectConnection("project-b");
    retainProjectConnection("project-b");

    await releaseProjectConnection("project-b");
    vi.advanceTimersByTime(1_000);
    await flush();
    // B still has a consumer; A's leaked retain is irrelevant to it.
    expect(stopB).not.toHaveBeenCalled();

    await releaseProjectConnection("project-b");
    vi.advanceTimersByTime(1_000);
    await flush();
    expect(stopB).toHaveBeenCalledTimes(1);
    expect(stopA).not.toHaveBeenCalled();
  });
});

describe("shared consumers release instead of stopping (wave-37)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProjectConnections();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    resetProjectConnections();
  });

  it("keeps one connection for two consumers of the same board", async () => {
    const boardPage = createProjectConnection("project-1");
    const presence = createProjectConnection("project-1");
    expect(presence).toBe(boardPage);

    await startProjectConnection(boardPage, "project-1");
    retainProjectConnection("project-1"); // BoardPage
    retainProjectConnection("project-1"); // usePresence

    const stop = vi.spyOn(boardPage, "stop");
    await releaseProjectConnection("project-1"); // BoardPage unmounts
    vi.advanceTimersByTime(1_000);
    await flush();
    // usePresence still owns it — presence must not drop because the board's
    // live-update effect tore down first.
    expect(stop).not.toHaveBeenCalled();
  });
});
