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

// Wave-18 pushes the class into its option-source and role-derived variants:
//  - SearchPage's four filter feeds (`membersRaw`/`projectsRaw`/`labelsRaw`/
//    `savedSearchesRaw` laundered failures into `?? []`, so dropdowns silently
//    offered nothing and users concluded "no members/labels/saved searches");
//  - CommandPalette's Saved group (a failed read vanished the whole group —
//    now a `<li role="alert">` row with inline retry, the hitsUnresolvable
//    shape, because a bare div would break listbox semantics);
//  - ProjectSettingsPage/WebhooksPage: the workspace ROLE fetch itself —
//    canManage/isAdmin derive from `workspace?.role`, so a failed read hid the
//    Add-member button (PSP) and the entire dead-letter section (Webhooks) for
//    real admins. The banner must sit OUTSIDE the region the flag gates.
const COMPONENTS = join(__dirname, "..", "components");

const SEARCH_FEEDS: Array<{
  raw: string;
  err: string;
  reload: string;
  alertId: string;
}> = [
  { raw: "membersRaw", err: "membersError", reload: "reloadMembers", alertId: "searchpage-members-error" },
  { raw: "projectsRaw", err: "projectsError", reload: "reloadProjects", alertId: "searchpage-projects-error" },
  { raw: "labelsRaw", err: "labelsError", reload: "reloadLabels", alertId: "searchpage-labels-error" },
  {
    raw: "savedSearchesRaw",
    err: "savedSearchesError",
    reload: "reloadSavedSearches",
    alertId: "searchpage-savedsearches-error",
  },
];

describe.each(SEARCH_FEEDS)(
  "SearchPage $raw feed surfaces its own failure",
  ({ raw, err, reload, alertId }) => {
    const content = source("SearchPage");

    it("the useApi destructure keeps error + reload", () => {
      const start = content.search(new RegExp(`data:\\s*${raw}\\b`));
      expect(start, `${raw} destructure was renamed`).toBeGreaterThan(-1);
      const block = content.slice(start, start + 200);
      expect(block, `${raw} discards its error`).toMatch(new RegExp(`error:\\s*${err}`));
      expect(block, `${raw} has no reload wired`).toMatch(new RegExp(`reload:\\s*${reload}`));
    });

    it("the error renders with a retry, above the filter form it belongs to", () => {
      const gate = content.indexOf(`{${err} && (`);
      const alert = content.indexOf(`id="${alertId}"`);
      const retry = content.indexOf(`onClick={${reload}}`);
      const form = content.indexOf("<form onSubmit={handleSearch}");
      expect(gate, `${err} banner was removed`).toBeGreaterThanOrEqual(0);
      expect(alert, `${err} ErrorAlert lost its stable id`).toBeGreaterThan(gate);
      expect(retry, `${err} has no retry wired to ${reload}`).toBeGreaterThan(gate);
      // All four feeds are filter controls INSIDE the form; the banner block
      // sits above it so the error is announced while the form is still empty.
      expect(gate, `${err} banner drifted inside the search form`).toBeLessThan(form);
    });
  },
);

describe("CommandPalette names a failed saved-searches read instead of dropping the group", () => {
  const content = readFileSync(join(COMPONENTS, "CommandPalette.tsx"), "utf8");

  it("the saved-searches destructure keeps error + reload and derives a failure flag", () => {
    expect(content, "savedRaw discards its error again").toMatch(
      /data:\s*savedRaw,[\s\S]{0,200}?error:\s*savedError,[\s\S]{0,200}?reload:\s*reloadSaved/,
    );
    expect(content, "no distinct failure flag (needs error AND raw === null)").toMatch(
      /const\s+savedSearchesFailed\s*=\s*savedError\s*!==\s*null\s*&&\s*savedRaw\s*===\s*null/,
    );
  });

  it("the failure row keeps listbox semantics with an inline retry", () => {
    const gate = content.indexOf("{savedSearchesFailed && (");
    expect(gate, "saved-searches failure row was removed").toBeGreaterThanOrEqual(0);
    const block = content.slice(gate, gate + 700);
    expect(block, "row lost role=alert").toMatch(/<li[\s\S]*role="alert"/);
    expect(block, "row lost its retry wiring").toMatch(/onClick=\{reloadSaved\}/);
    expect(block, "row lost its i18n key").toMatch(/commandPalette\.savedSearchesLoadFailed/);
  });
});

describe("workspace-role reads stop hiding admin surfaces (wave-18)", () => {
  it("ProjectSettingsPage exposes the role fetch error above the canManage regions", () => {
    const content = source("ProjectSettingsPage");
    expect(content, "workspace fetch discards its error again").toMatch(
      /data:\s*workspace,[\s\S]{0,200}?error:\s*workspaceError,[\s\S]{0,200}?reload:\s*reloadWorkspace/,
    );
    const gate = content.indexOf("{workspaceError && (");
    const alert = content.indexOf('id="projectsettingspage-workspacerole-error"');
    const retry = content.indexOf("onClick={reloadWorkspace}");
    // The big hidden surface is the per-member role/remove block. (The
    // header's Add-member button sits above the banner in source, but the
    // banner is its SIBLING outside every canManage conditional, so it
    // renders in exactly the failure that hides them.)
    // Per-member role/remove controls: the JSX gate is "{canManage && (" on
    // its own line — indentation-agnostic so a formatting sweep can't break it,
    // and anchored on the following <div> so the useMemo's `const canManage =`
    // can't match.
    const memberAdmin = content.search(/\{canManage && \(\s*\n\s*<div\b/);
    expect(gate, "role-error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "role ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "role error has no retry wired").toBeGreaterThan(gate);
    expect(memberAdmin, "per-member admin gate renamed; re-check reachability").toBeGreaterThan(-1);
    expect(
      gate,
      "role-error banner sits behind canManage — unreachable exactly when needed",
    ).toBeLessThan(memberAdmin);
    expect(content, "banner lost its i18n key").toMatch(/projectMember\.workspaceRoleLoadFailed/);
  });

  it("WebhooksPage exposes the role fetch error outside the isAdmin DLQ section", () => {
    const content = source("WebhooksPage");
    expect(content, "workspace fetch discards its error again").toMatch(
      /data:\s*workspace,[\s\S]{0,200}?error:\s*workspaceError,[\s\S]{0,200}?reload:\s*reloadWorkspace/,
    );
    const gate = content.indexOf("{workspaceError && (");
    const alert = content.indexOf('id="webhooks-workspacerole-error"');
    const retry = content.indexOf("onClick={reloadWorkspace}");
    const dlqGate = content.indexOf("{isAdmin && (");
    expect(gate, "role-error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "role ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "role error has no retry wired").toBeGreaterThan(gate);
    expect(dlqGate, "DLQ admin gate renamed; re-check reachability").toBeGreaterThan(-1);
    expect(
      gate,
      "role-error banner sits behind isAdmin — the dead-letter tools are hidden with it",
    ).toBeLessThan(dlqGate);
    expect(content, "banner lost its i18n key").toMatch(/webhook\.roleLoadFailed/);
  });
});

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

// Wave-19: BoardPage's three reads that kept discarding their error. Unlike
// the role-derivation sites, nothing here hides a control - the failure
// masquerades as a benign UI state instead: the <h1> froze on "Loading…"
// forever, epic swimlane lanes fell back to raw GUID labels, and custom-field
// chips silently vanished from every card. Each must expose error + reload,
// derive a null-guarded failed flag, and render a retryable banner in the
// board's banner column above the SprintBar.
describe("BoardPage project read", () => {
  const content = source("BoardPage");

  it("destructure exposes error + reload (no bare `data: project`)", () => {
    expect(
      content,
      "project fetch regressed to discarding its error",
    ).not.toMatch(/const\s*\{\s*data:\s*project\s*\}\s*=\s*useApi/);
    expect(content).toMatch(
      /data:\s*project,[\s\S]{0,200}?error:\s*projectError,[\s\S]{0,200}?reload:\s*reloadProject/,
    );
  });

  it("the h1 stops faking progress when the read already failed", () => {
    expect(content).toMatch(
      /project\?\.name \?\?\s*\(projectFailed \? t\("board\.projectNameUnavailable"\) : t\("common\.loading"\)\)/,
    );
  });

  it("a failed project read renders a retryable banner", () => {
    const flag = content.indexOf(
      "const projectFailed = projectError !== null && project === null;",
    );
    const gate = content.indexOf("{projectFailed && (");
    const alert = content.indexOf('id="boardpage-project-error"');
    const retry = content.indexOf("onClick={reloadProject}");
    expect(flag, "projectFailed null-guard lost").toBeGreaterThanOrEqual(0);
    expect(gate, "project banner was removed").toBeGreaterThan(flag);
    expect(alert, "project ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "project error has no retry wired").toBeGreaterThan(gate);
  });
});

describe("BoardPage epics read", () => {
  const content = source("BoardPage");

  it("destructure exposes error + reload + null-guarded failed flag", () => {
    expect(
      content,
      "epics fetch regressed to discarding its error",
    ).not.toMatch(/const\s*\{\s*data:\s*epics\s*\}\s*=\s*useApi/);
    expect(content).toMatch(
      /data:\s*epics,[\s\S]{0,200}?error:\s*epicsError,[\s\S]{0,200}?reload:\s*reloadEpics/,
    );
    expect(content).toMatch(
      /const\s+epicsFailed\s*=\s*epicsError\s*!==\s*null\s*&&\s*epics\s*===\s*null/,
    );
  });

  it("the lane-label failure is named while epic swimlanes are active", () => {
    const gate = content.indexOf("{epicsFailed && swimlaneMode === \"epic\" && (");
    const alert = content.indexOf('id="boardpage-epics-error"');
    const retry = content.indexOf("onClick={reloadEpics}");
    // Gating on swimlaneMode is deliberate: GUID lane labels only occur in
    // epic mode, and a banner for a harmless state would be dishonest noise.
    expect(gate, "epics banner removed or lost its swimlaneMode gate").toBeGreaterThanOrEqual(0);
    expect(alert, "epics ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "epics error has no retry wired").toBeGreaterThan(gate);
    expect(content).toMatch(/board\.epicsLoadFailed/);
  });
});

describe("BoardPage custom-fields read", () => {
  const content = source("BoardPage");

  it("destructure exposes error + reload + null-guarded failed flag", () => {
    expect(
      content,
      "customFields fetch regressed to discarding its error",
    ).not.toMatch(/const\s*\{\s*data:\s*customFieldsByTaskId\s*\}\s*=\s*useApi/);
    expect(content).toMatch(
      /data:\s*customFieldsByTaskId,[\s\S]{0,200}?error:\s*customFieldsError,[\s\S]{0,200}?reload:\s*reloadCustomFields/,
    );
    expect(content).toMatch(
      /const\s+customFieldsFailed\s*=\s*customFieldsError\s*!==\s*null\s*&&\s*customFieldsByTaskId\s*===\s*null/,
    );
  });

  it("the chip-loss renders a retryable banner above the board", () => {
    const gate = content.indexOf("{customFieldsFailed && (");
    const alert = content.indexOf('id="boardpage-customfields-error"');
    const retry = content.indexOf("onClick={reloadCustomFields}");
    const sprintBar = content.indexOf("<SprintBar");
    expect(gate, "customFields banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "customFields ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "customFields error has no retry wired").toBeGreaterThan(gate);
    expect(content).toMatch(/board\.customFieldsLoadFailed/);
    // Banners belong in the banner column, above the board area they explain.
    const projectGate = content.indexOf("{projectFailed && (");
    expect(projectGate, "project banner missing anchor for order check").toBeGreaterThanOrEqual(0);
    expect(gate, "banner order drifted").toBeLessThan(sprintBar);
  });
});

// Wave-20 hunts the two shapes the BoardPage wave could not see, because they
// were never useApi destructures:
//  - EpicsPage's loadEpics Promise.all kept its lists at [] on failure AND
//    rendered EmptyState ("no epics yet") as a confident claim, while its
//    banner was a dead-end with no retry (MilestonesPage already gates
//    `milestones.length === 0 && !error` and wires onClick={loadData});
//  - CommandPalette's hitsUnresolvable row named the failure but stranded the
//    user with no way out — projectsError was exposed, reload never destructured.
describe("EpicsPage load failure stops claiming the backlog is empty", () => {
  const content = source("EpicsPage");

  it("the load-error banner has a stable id and a retry wired back to loadEpics", () => {
    const gate = content.indexOf("{error && (");
    const alert = content.indexOf('id="epicspage-load-error"');
    const retry = content.indexOf("onClick={loadEpics}");
    expect(gate, "load-error banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "load-error ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "load-error banner has no retry").toBeGreaterThan(gate);
    expect(content.slice(gate, gate + 400)).toMatch(/common\.retry/);
  });

  it("EmptyState is gated on !error so a failed load never says 'no epics yet'", () => {
    expect(
      content,
      "the epics empty state lost its !error gate",
    ).toMatch(/epics\.length === 0 && !error/);
    expect(
      content,
      "regressed to the ungated `epics.length === 0 ?` branch",
    ).not.toMatch(/\) : epics\.length === 0 \? \(\s*\n\s*<EmptyState/);
    const gate = content.indexOf("{error && (");
    const empty = content.indexOf("epics.length === 0 && !error");
    expect(empty, "banner/empty-state order drifted").toBeGreaterThan(gate);
  });
});

describe("CommandPalette hitsUnresolvable row is not a dead end", () => {
  const content = readFileSync(join(COMPONENTS, "CommandPalette.tsx"), "utf8");

  it("the projects destructure exposes reload next to error", () => {
    expect(
      content,
      "projects fetch regressed to omitting reload from its destructure",
    ).not.toMatch(
      /const\s*\{\s*data:\s*projectsRaw,\s*error:\s*projectsError\s*\}\s*=\s*useApi/,
    );
    expect(content).toMatch(
      /data:\s*projectsRaw,[\s\S]{0,200}?error:\s*projectsError,[\s\S]{0,200}?reload:\s*reloadProjects/,
    );
  });

  it("the failure row keeps listbox semantics with an inline retry", () => {
    const gate = content.indexOf("{hitsUnresolvable && (");
    expect(gate, "hitsUnresolvable row was removed").toBeGreaterThanOrEqual(0);
    const block = content.slice(gate, gate + 1400);
    expect(block, "row lost role=alert").toMatch(/<li[\s\S]*role="alert"/);
    expect(block, "row lost its retry wiring").toMatch(/onClick=\{reloadProjects\}/);
    expect(block, "row lost its i18n key").toMatch(/commandPalette\.projectsLoadFailed/);
    expect(block, "retry button lost its label").toMatch(/common\.retry/);
  });
});
