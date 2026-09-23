import { describe, it, expect, vi } from "vitest";
import { matchRoute, once, prefetchRoute } from "../lib/routePrefetch";

// matchRoute is the table that decides which chunk a hover/focus warms; a
// miss costs the old Suspense-fallback behavior, a wrong hit downloads the
// wrong page. once() carries the two failure modes that matter: dedupe (or
// every mousemove across a link re-requests) and re-arm after a failed load
// (or one flaky network poisons the route for the session).

const flush = () => new Promise((r) => setTimeout(r, 0));

// Prefetch glue: a matched href must actually trigger the page import.
// The factory runs when routePrefetch's dynamic import first materializes
// the mock — if matchRoute/prefetchRoute never fire, the spy stays at 0.
const { changelogLoad } = vi.hoisted(() => ({ changelogLoad: vi.fn() }));
vi.mock("../pages/ChangelogPage", () => {
  changelogLoad();
  return { ChangelogPage: () => null };
});

describe("matchRoute", () => {
  it("matches the public top-level routes", () => {
    expect(matchRoute("/")).toBe("dashboard");
    expect(matchRoute("/login")).toBe("login");
    expect(matchRoute("/register")).toBe("register");
    expect(matchRoute("/changelog")).toBe("changelog");
    expect(matchRoute("/blog")).toBe("blog");
    expect(matchRoute("/privacy")).toBe("privacy");
    expect(matchRoute("/terms")).toBe("terms");
  });

  it("matches the session routes", () => {
    expect(matchRoute("/profile")).toBe("profile");
    expect(matchRoute("/settings")).toBe("settings");
    expect(matchRoute("/notifications")).toBe("notifications");
    expect(matchRoute("/saved-searches")).toBe("saved-searches");
  });

  it("matches workspace-level shapes with arbitrary ids", () => {
    expect(matchRoute("/workspaces/ws-1")).toBe("workspace");
    expect(matchRoute("/workspaces/8f3c2a10-aaaa-bbbb-cccc-000000000001")).toBe(
      "workspace",
    );
    expect(matchRoute("/workspaces/ws-1/my-tasks")).toBe("my-tasks");
    expect(matchRoute("/workspaces/ws-1/search")).toBe("search");
    expect(matchRoute("/workspaces/ws-1/webhooks")).toBe("workspace-webhooks");
  });

  it("matches project-level shapes with arbitrary ids", () => {
    expect(matchRoute("/workspaces/ws-1/projects/pr-9")).toBe("board");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/sprints")).toBe("sprints");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/reports")).toBe("reports");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/epics")).toBe("epics");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/milestones")).toBe(
      "milestones",
    );
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/knowledge")).toBe(
      "knowledge",
    );
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/labels")).toBe("labels");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/fields")).toBe("fields");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/templates")).toBe(
      "templates",
    );
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/github")).toBe("github");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/activities")).toBe(
      "activities",
    );
  });

  it("keeps the two /settings routes distinct", () => {
    // Account settings is top-level; project settings is nested under a
    // project — conflating them would prefetch the wrong page on hover.
    expect(matchRoute("/settings")).toBe("settings");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/settings")).toBe(
      "project-settings",
    );
  });

  it("strips query strings and hashes", () => {
    expect(matchRoute("/profile?tab=security")).toBe("profile");
    expect(matchRoute("/notifications#invite")).toBe("notifications");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9?filter=open")).toBe(
      "board",
    );
  });

  it("ignores one trailing slash but keeps the root path intact", () => {
    expect(matchRoute("/profile/")).toBe("profile");
    expect(matchRoute("/workspaces/ws-1/")).toBe("workspace");
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/sprints/")).toBe(
      "sprints",
    );
    expect(matchRoute("/")).toBe("dashboard");
  });

  it("returns null for unknown, over-long, or external paths", () => {
    expect(matchRoute("/nope")).toBeNull();
    expect(matchRoute("/workspaces/ws-1/unknown")).toBeNull();
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/unknown")).toBeNull();
    // More id segments than any route has — must not partially match.
    expect(matchRoute("/workspaces/ws-1/projects/pr-9/sprints/extra")).toBeNull();
    expect(matchRoute("https://example.com/profile")).toBeNull();
    expect(matchRoute("mailto:team@example.com")).toBeNull();
    expect(matchRoute("")).toBeNull();
  });
});

describe("once", () => {
  it("runs the loader a single time per key", async () => {
    const load = vi.fn(() => Promise.resolve({}));
    once("test-dedupe", load);
    once("test-dedupe", load);
    once("test-dedupe", load);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("re-arms the key after a failed load so the next hover retries", async () => {
    const load = vi.fn(() => Promise.reject(new Error("chunk failed")));
    once("test-retry", load);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);

    once("test-retry", load);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps distinct keys independent", async () => {
    const a = vi.fn(() => Promise.resolve({}));
    const b = vi.fn(() => Promise.resolve({}));
    once("test-key-a", a);
    once("test-key-b", b);
    once("test-key-a", a);
    await flush();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("prefetchRoute", () => {
  it("loads the matched page chunk for an internal href", async () => {
    prefetchRoute("/changelog?utm=hover");
    await flush();
    expect(changelogLoad).toHaveBeenCalledTimes(1);
  });

  it("is a no-op for unmatched hrefs (no throw, no load)", () => {
    expect(() => prefetchRoute("/definitely/not/a/route")).not.toThrow();
  });
});
