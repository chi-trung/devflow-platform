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
//
// Wave-17 extends the class to its systemic variant: `const { data: members =
// [] } = useApi(...)` discards `error` entirely, so a failed roster read yields
// myRole undefined -> isAdmin false and admin controls (epic delete + blockers,
// milestone delete, knowledge delete, sprint manage) hard-hide with zero
// explanation. The same pages now must expose error + reload and render a
// retryable banner outside the regions those flags gate. Plus AiPlanPanel:
// getLatestAiPlan's blanket catch turned a failed read into "no plan yet" —
// hiding Apply/Regenerate over a plan that exists and pushing the user toward
// the generate button, whose only effect could overwrite it.

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

// Wave-17: the four roster-feeding role derivations that used to swallow the
// fetch error into `= []` / undefined, silently flipping isAdmin / canManage to
// false and hard-hiding admin controls.
const ROSTER_PAGES: Array<{
  page: string;
  alertId: string;
  // A source-order anchor proving the banner precedes the region the failed
  // roster disables — if a control gate ever moves above the banner, the
  // failure goes unreachable again.
  gatedAnchor: RegExp;
}> = [
  { page: "EpicsPage", alertId: "epicspage-members-error", gatedAnchor: /\{isAdmin &&/ },
  { page: "MilestonesPage", alertId: "milestonespage-members-error", gatedAnchor: /isAdmin/ },
  { page: "KnowledgePage", alertId: "knowledgepage-members-error", gatedAnchor: /canDelete=\{isAdmin\}/ },
  {
    page: "SprintPlanningPage",
    alertId: "sprintplanningpage-members-error",
    gatedAnchor: /\{canManage &&/,
  },
];

describe.each(ROSTER_PAGES)(
  "$page surfaces a failed roster read instead of hiding admin controls",
  ({ page, alertId, gatedAnchor }) => {
    const content = source(page);

    it("the roster useApi exposes error + reload (no discarded `= []`)", () => {
      expect(
        content,
        "roster fetch regressed to discarding its error state",
      ).not.toMatch(/const\s*\{\s*data:\s*members\s*=\s*\[\]\s*\}\s*=\s*useApi/);
      const start = content.search(/useApi<WorkspaceMemberResponse\[\]>/);
      expect(start, "roster useApi call was renamed/moved").toBeGreaterThan(-1);
      const window = content.slice(Math.max(0, start - 350), start);
      expect(window, "roster error is not destructured").toMatch(
        /error:\s*membersError/,
      );
      expect(window, "roster has no reload wired").toMatch(
        /reload:\s*reloadMembers/,
      );
    });

    it("the roster error renders with a retry wired back to the roster loader", () => {
      const gate = content.indexOf("{membersError && (");
      const alert = content.indexOf(`id="${alertId}"`);
      const retry = content.indexOf("onClick={reloadMembers}");
      expect(gate, "roster error banner was removed").toBeGreaterThanOrEqual(0);
      expect(alert, "roster ErrorAlert lost its stable id").toBeGreaterThan(gate);
      expect(retry, "roster error has no retry to reloadMembers").toBeGreaterThan(
        gate,
      );
    });

    it("the banner is rendered before the admin region it explains", () => {
      const banner = content.indexOf("{membersError && (");
      const match = content.slice(banner).search(gatedAnchor);
      expect(banner, "roster banner removed").toBeGreaterThanOrEqual(0);
      expect(match, "gated admin region not found after the banner").toBeGreaterThan(
        -1,
      );
    });
  },
);

describe("AiPlanPanel does not launder a failed plan read into 'no plan yet'", () => {
  const content = readFileSync(
    join(__dirname, "..", "components", "ai", "AiPlanPanel.tsx"),
    "utf8",
  );

  it("the load catch names the failure instead of silently clearing the plan", () => {
    expect(
      content,
      "blanket silent catch is back: a failed read would fake the fresh-task state",
    ).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\s*if\s*\(!cancelled\)\s*setPlan\(null\);\s*\}\s*\)/);
    expect(
      content,
      "load failure no longer exposes ai.planLoadFailed",
    ).toMatch(/ai\.planLoadFailed/);
  });

  it("the load error renders with a retry and gates the overwrite button", () => {
    const gate = content.indexOf("{loadError && (");
    const alert = content.indexOf('id="aiplanpanel-load-error"');
    const retry = content.indexOf("setLoadTick((n) => n + 1)");
    expect(gate, "plan-load error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "plan-load ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "plan-load error has no retry path").toBeGreaterThan(gate);
    // The generate button is the destructive one here (it can overwrite the
    // plan whose read failed), so it must stay gated while the read is errored.
    expect(
      content,
      "Ask-AI-to-Plan button no longer gated on loadError — retry path must keep it hidden",
    ).toMatch(/!loading && !plan && !generating && !loadError/);
  });
});
