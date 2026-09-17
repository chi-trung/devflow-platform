import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Duplicate ProjectHub connection probe (wave-36). BoardPage's live-update
// effect and usePresence both called createProjectConnection for the same
// project, so every board tab opened TWO sockets in the same hub group.
// The hub broadcasts to Clients.OthersInGroup, so a second user in the same
// project saw the same userId join twice (two connection ids, two
// user-joined broadcasts) - their presence list rendered the person twice,
// and every project-event arrived duplicated.

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
          on() {},
          off() {},
          async start() {},
          async stop() {},
          async invoke() {},
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
} from "../lib/realtime";

describe("project hub connection is shared, not duplicated (wave-36)", () => {
  beforeEach(() => {
    resetProjectConnections();
  });
  afterEach(() => {
    resetProjectConnections();
  });

  it("returns the same connection for the same project", () => {
    const a = createProjectConnection("project-1");
    const b = createProjectConnection("project-1");
    expect(a).toBe(b);
  });

  it("keeps separate connections for separate projects", () => {
    const a = createProjectConnection("project-1");
    const b = createProjectConnection("project-2");
    expect(a).not.toBe(b);
  });

  it("does not stop the connection while a consumer still holds it", async () => {
    const conn = createProjectConnection("project-1");
    const stop = vi.spyOn(conn, "stop");

    retainProjectConnection("project-1");
    retainProjectConnection("project-1");

    await releaseProjectConnection("project-1");
    expect(stop).not.toHaveBeenCalled();

    await releaseProjectConnection("project-1");
    // The last release schedules a 1s delayed stop; it must not fire eagerly.
    expect(stop).not.toHaveBeenCalled();
  });

  it("does not create an unbounded connection map across re-renders", () => {
    for (let i = 0; i < 5; i++) {
      createProjectConnection("project-1");
    }
    // Repeated calls for the same project must reuse, not accumulate.
    const first = createProjectConnection("project-1");
    const second = createProjectConnection("project-1");
    expect(first).toBe(second);
    expect(
      (createProjectConnection("project-1") as unknown as { id: string }).id,
    ).toBe((first as unknown as { id: string }).id);
  });
});
