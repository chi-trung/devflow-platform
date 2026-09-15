import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Wave-16 probe class: a swallowed READ that quietly disables a control. When
// the roster fetch fails, the page still renders — but the thing the data gates
// (an "Add member" button, an actor-filter dropdown) is empty/disabled with no
// reason given. The fail-closed list tests can't see it: nothing reads into the
// list's `error` state, the read just fails into an empty array. Three
// invariants, greppable per page:
//  1. the catch sets a dedicated error state (no bare catch / silent []);
//  2. the render shows that error with a Button wired to the SAME loader (a
//     dead-end banner is the wave-10 shape);
//  3. the banner is reachable in the exact failure it reports — for
//     ProjectSettingsPage that means OUTSIDE the `inviting &&` form, because a
//     failed roster is what disables the Create button that would open the form.

const PAGES = join(__dirname, "..", "pages");

function source(page: string): string {
  return readFileSync(join(PAGES, `${page}.tsx`), "utf8");
}

describe("ProjectSettingsPage surfaces a failed workspace-roster read", () => {
  const content = source("ProjectSettingsPage");

  it("the roster catch sets an error state, not a silent empty array", () => {
    const start = content.search(/const loadWorkspaceMembers = /);
    expect(start, "loadWorkspaceMembers loader was renamed").toBeGreaterThan(-1);
    const body = content.slice(start, start + 900);
    expect(body, "roster failure no longer exposes an error").toMatch(
      /catch\s*\{[\s\S]*setWorkspaceMembersError\(/,
    );
  });

  it("the roster error renders with a retry wired back to the loader", () => {
    const gate = content.indexOf("{workspaceMembersError && (");
    const alert = content.indexOf('id="projectsettingspage-workspacemembers-error"');
    const retry = content.indexOf("onClick={loadWorkspaceMembers}");
    expect(gate, "roster error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "roster ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "roster error has no retry to the loader").toBeGreaterThan(gate);
  });

  it("the banner sits outside the invite form (the failure hides the form)", () => {
    const banner = content.indexOf("{workspaceMembersError && (");
    const inviting = content.indexOf("{inviting && (");
    expect(banner, "roster banner removed").toBeGreaterThanOrEqual(0);
    expect(inviting, "invite form gate removed").toBeGreaterThanOrEqual(0);
    // A dead roster leaves availableWorkspaceMembers empty, which disables the
    // Create button — so if the banner lived inside `inviting &&` it would be
    // unreachable precisely when it is needed. Banner must precede the form.
    expect(
      banner,
      "roster error banner is inside the inviting form — unreachable when the roster fails",
    ).toBeLessThan(inviting);
  });
});

describe("ActivitiesPage surfaces a failed actor-list read", () => {
  const content = source("ActivitiesPage");

  it("the actor-list catch sets an error state, not a silent empty dropdown", () => {
    const start = content.search(/const loadActors = /);
    expect(start, "loadActors loader was renamed").toBeGreaterThan(-1);
    const body = content.slice(start, start + 700);
    expect(body, "actor-list failure no longer exposes an error").toMatch(
      /catch\s*\{[\s\S]*setMembersError\(/,
    );
  });

  it("the actor error renders with a retry wired back to the loader", () => {
    const gate = content.indexOf("{membersError && (");
    const alert = content.indexOf('id="activities-actors-error"');
    const retry = content.indexOf("onClick={loadActors}");
    expect(gate, "actor error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "actor ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "actor error has no retry to the loader").toBeGreaterThan(gate);
  });
});
