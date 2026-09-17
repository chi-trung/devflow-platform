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

describe("BoardPage members read (wave-34)", () => {
  const content = source("BoardPage");

  it("destructure exposes error + reload + null-guarded failed flag", () => {
    expect(
      content,
      "members fetch regressed to discarding its error",
    ).not.toMatch(/const\s*\{\s*data:\s*members\s*\}\s*=\s*useApi/);
    expect(content).toMatch(
      /data:\s*members,[\s\S]{0,200}?error:\s*membersError,[\s\S]{0,200}?reload:\s*reloadMembers/,
    );
    expect(content).toMatch(
      /const\s+membersFailed\s*=\s*membersError\s*!==\s*null\s*&&\s*members\s*===\s*null/,
    );
  });

  it("the failed roster renders a retryable banner outside every gate it disables", () => {
    // The roster derives `isAdmin`: on failure an Owner reads as a bystander,
    // so Import (`{!creating && isAdmin && (`) and SprintBar's edit controls
    // hard-hide. The FilterBar retry only renders while the assignee dropdown
    // is visible, and the assigneeFilterUnknown banner needs a typed search -
    // neither names the missing admin actions when the board first loads.
    const gate = content.indexOf("{membersFailed && (");
    const alert = content.indexOf('id="boardpage-members-error"');
    const retry = content.indexOf("onClick={reloadMembers}");
    expect(gate, "members banner was removed").toBeGreaterThanOrEqual(0);
    expect(alert, "members ErrorAlert lost its stable id").toBeGreaterThan(gate);
    expect(retry, "members error has no retry wired").toBeGreaterThan(gate);
    expect(content).toMatch(/board\.membersLoadFailed/);
    // The banner must sit above the board area, like its siblings.
    const sprintBar = content.indexOf("<SprintBar");
    expect(gate, "banner drifted below the board area").toBeLessThan(sprintBar);
    // Unconditional: unlike the epics banner (GUID lanes only show in epic
    // mode), the roster gates admin actions on every board, so no extra
    // condition may gate the banner.
    expect(content).toMatch(/\{membersFailed && \(/);
    expect(content).not.toMatch(
      /\{membersFailed && [^(\s][\s\S]{0,80}?\(/,
    );
  });

  it("both locales carry the new membersLoadFailed key", () => {
    for (const loc of ["en", "vi"] as const) {
      const dict = JSON.parse(
        readFileSync(join(__dirname, "..", "i18n", `${loc}.json`), "utf8"),
      );
      expect(
        dict.board.membersLoadFailed,
        `${loc} lost board.membersLoadFailed`,
      ).toBeTruthy();
    }
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

// Wave-21 keeps the dead-end class going: WorkspacePage replaced two whole
// regions with a BARE <ErrorAlert message=... /> — the reload was already in
// both useApi destructures, the banner just never offered it.
describe("WorkspacePage load banners offer the reload they already have", () => {
  const content = source("WorkspacePage");

  const DEAD_ENDS: Array<{
    label: string;
    alertId: string;
    bare: RegExp;
    retry: string;
  }> = [
    {
      label: "projects",
      alertId: "workspacepage-projects-error",
      bare: /<ErrorAlert message=\{projError\} \/>/,
      retry: "onClick={reload}",
    },
    {
      label: "members",
      alertId: "workspacepage-members-error",
      bare: /<ErrorAlert message=\{membersError\} \/>/,
      retry: "onClick={reloadMembers}",
    },
  ];

  describe.each(DEAD_ENDS)("$label read", ({ alertId, bare, retry }) => {
    it(`the ${alertId} banner wires a retry and is not a bare dead end`, () => {
      expect(content, `bare <ErrorAlert> is back for ${alertId}`).not.toMatch(bare);
      const alert = content.indexOf(`id="${alertId}"`);
      expect(alert, "banner lost its stable id").toBeGreaterThan(-1);
      const block = content.slice(alert, alert + 400);
      expect(block, "banner lost its retry wiring").toMatch(
        new RegExp(retry.replace(/[{}]/g, "\\$&")),
      );
      expect(block, "retry button lost its label").toMatch(/common\.retry/);
    });
  });

  it("both destructures still expose the reload the banners call", () => {
    expect(content).toMatch(/error:\s*projError,[\s\S]{0,120}?reload,/);
    expect(content).toMatch(/error:\s*membersError,[\s\S]{0,120}?reload:\s*reloadMembers/);
  });
});

// Wave-22: the remaining load-failure banners in the useApi family. Each site
// names its failure and then strands the reader — BoardPage's task-list branch,
// ProjectSettingsPage's member roster (its sibling workspace-roster banner has
// had a retry since wave-16), and WorkspacePage's header read. Lock the same
// three invariants as wave-21: no bare <ErrorAlert message={X} />, stable id,
// retry wired to the SAME loader inside the banner block.
describe("wave-22 load banners stop dead-ending their regions", () => {
  const DEAD_ENDS: Array<{
    file: string;
    alertId: string;
    bare: RegExp;
    retry: string;
  }> = [
    {
      file: "BoardPage",
      alertId: "boardpage-tasks-error",
      bare: /<ErrorAlert message=\{error\} \/>/,
      retry: "onClick={reload}",
    },
    {
      file: "ProjectSettingsPage",
      alertId: "projectsettingspage-members-error",
      bare: /<ErrorAlert message=\{membersError\} \/>/,
      retry: "onClick={loadMembers}",
    },
    {
      file: "WorkspacePage",
      alertId: "workspacepage-workspace-error",
      bare: /<ErrorAlert message=\{wsError \?\? t\("workspace\.notFound"\)\} \/>/,
      retry: "onClick={reloadWorkspace}",
    },
  ];

  describe.each(DEAD_ENDS)("$file", ({ file, alertId, bare, retry }) => {
    it(`${alertId} is a retryable banner, not a bare dead end`, () => {
      const content = source(file);
      expect(content, `bare <ErrorAlert> is back for ${alertId}`).not.toMatch(
        bare,
      );
      const alert = content.indexOf(`id="${alertId}"`);
      expect(alert, "banner lost its stable id").toBeGreaterThan(-1);
      const block = content.slice(alert, alert + 1400);
      expect(block, "banner lost its retry wiring").toMatch(
        new RegExp(retry.replace(/[{}]/g, "\$&")),
      );
      expect(block, "retry button lost its label").toMatch(/common\.retry/);
    });
  });

  it("WorkspacePage's not-found branch keeps no retry (404 is terminal)", () => {
    const content = source("WorkspacePage");
    // The retry must be conditional on wsError itself, not on the merged
    // `wsError || !workspace` branch — retrying a workspace you can't see
    // re-fails forever and the honest exit is the back link above.
    const alert = content.indexOf('id="workspacepage-workspace-error"');
    expect(alert).toBeGreaterThan(-1);
    const block = content.slice(alert, alert + 1400);
    expect(block, "retry stopped being conditional on wsError").toMatch(
      /\{wsError && \(\s*\n\s*<Button[^>]*onClick=\{reloadWorkspace\}/,
    );
  });

  it("both useApi destructures still expose the reloads the banners call", () => {
    expect(source("BoardPage")).toMatch(
      /data: tasksRaw,[\s\S]{0,120}?reload,/,
    );
    expect(source("WorkspacePage")).toMatch(
      /error:\s*wsError,[\s\S]{0,120}?reload:\s*reloadWorkspace/,
    );
  });
});

// Wave-23: DashboardPage's workspaces read. `error` at the top destructure is
// provably load-only (DashboardPage has no setError), and the failed list
// feeds every downstream surface, so the bare banner was the last stranded
// region in the useApi family - the sibling dashboard-error block a few lines
// above already ships retryable.
describe("DashboardPage workspaces banner got the reload it had", () => {
  const content = source("DashboardPage");

  it("the workspaces destructure exposes error and reload together", () => {
    const start = content.search(/useApi<unknown>\(\(\) => api\("\/workspaces"\)/);
    expect(start, "workspaces useApi call was renamed").toBeGreaterThan(-1);
    const window = content.slice(Math.max(0, start - 220), start);
    expect(window, "workspaces error is not destructured").toMatch(
      /error,/,
    );
    expect(window, "workspaces reload is not destructured").toMatch(
      /reload,/,
    );
  });

  it("the banner is retryable, not a bare dead end", () => {
    expect(
      content,
      "bare <ErrorAlert message={error} /> is back",
    ).not.toMatch(/: error \?\s*\n\s*<ErrorAlert message=\{error\} \/>\s*\n\s*\) : !workspaces/);
    const alert = content.indexOf('id="dashboardpage-workspaces-error"');
    expect(alert, "banner lost its stable id").toBeGreaterThan(-1);
    const block = content.slice(alert, alert + 1400);
    expect(block, "banner lost its retry wiring").toMatch(
      /onClick=\{reload\}/,
    );
    expect(block, "retry button lost its label").toMatch(/common\.retry/);
  });
});

// Wave-24: the false-absence half of the class inside the task panel. Both
// components clear/reuse a single `error` state for load AND mutation (the
// wave-22 exemption against uniform retry buttons), but their list catches
// still leave the array empty on failure - so the "nothing here" line rendered
// underneath the failure banner, claiming an absence that was never observed.
// The fix is the gate only (EpicsPage's wave-20 shape); the loads already
// re-run on panel mount/task switch.
describe("task panel lists stop claiming absence under their own failure", () => {
  const tdp = readFileSync(
    join(COMPONENTS, "board", "TaskDetailPanel.tsx"),
    "utf8",
  );
  const tts = readFileSync(
    join(COMPONENTS, "board", "TimeTrackingSection.tsx"),
    "utf8",
  );

  it("TaskDetailPanel gates 'No comments' on !commentError", () => {
    expect(
      tdp,
      "un-gated empty-comments branch is back",
    ).not.toMatch(/\) : comments\.length === 0 \? \(\s*\n\s*<p/);
    expect(
      tdp,
      "comments empty-state lost its error gate",
    ).toMatch(/comments\.length === 0 && !commentError/);
  });

  it("TimeTrackingSection gates 'No time logged' on !error", () => {
    expect(
      tts,
      "un-gated empty-entries branch is back",
    ).not.toMatch(/\) : entries\.length === 0 \? \(\s*\n\s*<p/);
    expect(
      tts,
      "entries empty-state lost its error gate",
    ).toMatch(/entries\.length === 0 && !error/);
  });
});

describe("template card apply/delete hold one click in flight", () => {
  const card = readFileSync(
    join(COMPONENTS, "templates", "TemplatesCard.tsx"),
    "utf8",
  );

  it("handleApply guards before the task-minting POST", () => {
    const window = card.slice(
      card.indexOf("async function handleApply"),
      card.indexOf("async function handleApply") + 1400,
    );
    expect(
      window,
      "apply POSTs /apply (a fresh task per call) with no in-flight guard",
    ).toMatch(/if \(applyingId\) return;\s*\n\s*setApplyingId\(template\.id\);[\s\S]*await applyTemplate/);
    expect(
      card,
      "apply button lost its disabled wiring",
    ).toMatch(/disabled=\{applyingId !== null\}/);
  });

  it("handleDelete guards before the row-deleting DELETE", () => {
    const window = card.slice(
      card.indexOf("async function handleDelete"),
      card.indexOf("async function handleDelete") + 1400,
    );
    expect(
      window,
      "a double-click sends a second DELETE for the removed row (404 -> error toast after success)",
    ).toMatch(/if \(deletingId\) return;\s*\n\s*setDeletingId\(template\.id\);[\s\S]*await deleteTemplate/);
    expect(
      card,
      "delete button lost its disabled wiring",
    ).toMatch(/disabled=\{deletingId !== null\}/);
  });
});

describe("knowledge page save failure is named where the user can see it", () => {
  const kp = source("KnowledgePage");

  it("create/edit catch sets the in-dialog error, not the page banner", () => {
    expect(
      kp,
      "save failure renders behind the open z-[70] Dialog backdrop again",
    ).toMatch(/catch \(err\) \{\s*(\/\/[^\n]*\s*)*setSaveError\(err instanceof Error \? err\.message : t\("knowledge\.saveFailed"\)\)/);
    expect(
      kp,
      "in-dialog ErrorAlert wiring is gone",
    ).toMatch(/\{saveError && \(\s*\n\s*<ErrorAlert id="knowledge-save-error"/);
  });

  it("supersede closes its dialog before awaiting", () => {
    expect(
      kp,
      "supersede failure would hide behind the open overlay",
    ).toMatch(/setSuperseding\(null\);\s*\n\s*try \{\s*\n\s*await supersedeKnowledgeEntry/);
  });
});

describe("subtask detach holds one click in flight", () => {
  const sub = readFileSync(
    join(COMPONENTS, "board", "SubtaskSection.tsx"),
    "utf8",
  );

  it("detach guards before the un-parenting DELETE", () => {
    const window = sub.slice(
      sub.indexOf("async function detach"),
      sub.indexOf("async function detach") + 1400,
    );
    expect(
      window,
      "a double-click sends a second DELETE whose handler answers 409 after the row already detached",
    ).toMatch(/if \(detachingId\) return;\s*\n\s*setDetachingId\(subtask\.id\);[\s\S]*method: "DELETE"/);
    expect(
      sub,
      "detach button lost its disabled wiring",
    ).toMatch(/disabled=\{detachingId !== null\}/);
  });
});

describe("saved-search handoff survives a same-board navigate", () => {
  const bp = source("BoardPage");

  it("the ?fs= effect re-runs when the handoff arrives after mount", () => {
    const start = bp.indexOf('searchParams.get("fs")');
    expect(start, "the saved-search handoff effect was renamed").toBeGreaterThan(-1);
    const window = bp.slice(start, start + 1500);
    expect(
      window,
      "palette ?fs= navigation while already on the board is silently dropped (deps reverted to mount-only)",
    ).toMatch(/}, \[fsParam, setSearchParams\]\);/);
    expect(
      window,
      "mount-only eslint escape returned on the handoff effect",
    ).not.toMatch(/exhaustive-deps\s*\n\s*\}, \[\]\);/);
    expect(
      window,
      "handoff no longer strips itself, so the re-run would loop",
    ).toMatch(/next\.delete\("fs"\);/);
  });
});

describe("row deletes hold one click in flight (wave-28)", () => {
  const ds = readFileSync(
    join(COMPONENTS, "board", "DependencySection.tsx"),
    "utf8",
  );
  const tdp = readFileSync(
    join(COMPONENTS, "board", "TaskDetailPanel.tsx"),
    "utf8",
  );

  it("removeDependency guards before the un-linking DELETE", () => {
    const window = ds.slice(
      ds.indexOf("async function removeDependency"),
      ds.indexOf("async function removeDependency") + 1400,
    );
    expect(
      window,
      "a double-click sends a second DELETE whose handler answers 404 after the dependency already removed",
    ).toMatch(/if \(removingId\) return;\s*\n\s*setRemovingId\(dependency\.id\);[\s\S]*await removeTaskDependency\(/);
    expect(
      ds,
      "remove-blocker button lost its disabled wiring",
    ).toMatch(/disabled=\{removingId !== null\}/);
  });

  it("deleteComment guards before the row DELETE", () => {
    const window = tdp.slice(
      tdp.indexOf("async function deleteComment"),
      tdp.indexOf("async function deleteComment") + 1400,
    );
    expect(
      window,
      "comment NotFound-after-success resurfaced",
    ).toMatch(/if \(deletingCommentId\) return;\s*\n\s*setDeletingCommentId\(comment\.id\);[\s\S]*method: "DELETE"/);
    expect(
      tdp,
      "delete-comment button lost its disabled wiring",
    ).toMatch(/disabled=\{deletingCommentId !== null\}/);
  });

  it("deleteAttachment guards before the row DELETE", () => {
    const window = tdp.slice(
      tdp.indexOf("async function deleteAttachment"),
      tdp.indexOf("async function deleteAttachment") + 1400,
    );
    expect(
      window,
      "attachment NotFound-after-success resurfaced",
    ).toMatch(/if \(deletingAttachmentId\) return;\s*\n\s*setDeletingAttachmentId\(att\.id\);[\s\S]*method: "DELETE"/);
    expect(
      tdp,
      "delete-attachment button lost its disabled wiring",
    ).toMatch(/disabled=\{deletingAttachmentId !== null\}/);
  });
});

describe("clipboard confirmation follows the promise (wave-29)", () => {
  const pat = readFileSync(
    join(COMPONENTS, "settings", "PATSection.tsx"),
    "utf8",
  );

  it("waits for writeText before claiming the one-time token copied", () => {
    const window = pat.slice(
      pat.indexOf("async function handleCopyToken"),
      pat.indexOf("async function handleCopyToken") + 600,
    );
    expect(
      window,
      "the token shows once; a premature toast hides a rejected write",
    ).toMatch(
      /await navigator\.clipboard\.writeText\(createdToken\);\s*\n\s*push\(t\("pat\.copied"\)\);\s*\n\s*\} catch \{\s*\n\s*push\(t\("pat\.copyFailed"\), "error"\);/,
    );
    expect(
      window,
      "the failure path lost its i18n key",
    ).toMatch(/pat\.copyFailed/);
  });

  it("the copy button routes through the guarded handler", () => {
    expect(
      pat,
      "the button regressed to a fire-and-forget write with a success toast",
    ).not.toMatch(
      /void navigator\.clipboard\.writeText\(createdToken\);\s*\n\s*push\(t\("pat\.copied"\)\);/,
    );
    expect(pat, "the copy button lost its handler wiring").toMatch(
      /onClick=\{\(\) => void handleCopyToken\(\)\}/,
    );
  });

  it("both locales name the manual fallback", () => {
    for (const loc of ["en", "vi"] as const) {
      const dict = JSON.parse(
        readFileSync(join(__dirname, "..", "i18n", `${loc}.json`), "utf8"),
      );
      expect(dict.pat.copyFailed, `${loc} lost pat.copyFailed`).toBeTruthy();
    }
  });
});

describe("webhook test fires show their verdict, DLQ seeds on mount (wave-31)", () => {
  const content = source("WebhooksPage");

  it("handleTest consumes the WebhookTestResponse instead of discarding it", () => {
    const start = content.indexOf("async function handleTest(");
    expect(start, "handleTest was renamed").toBeGreaterThan(-1);
    const end = content.indexOf("async function handleDelete(", start);
    const window = content.slice(start, end === -1 ? start + 2200 : end);
    expect(
      window,
      "verdict body still swallowed: a 200 with delivered:false reads as success",
    ).toMatch(/const verdict = await testWebhook\(workspaceId, webhookId\);/);
    expect(
      window,
      "verdict never recorded per webhook",
    ).toMatch(/setTestVerdicts\(\(prev\) => \(\{\s*\.\.\.prev, \[webhookId\]: verdict\s*\}\)\);/);
    expect(
      window,
      "undelivered verdict has no failure feedback",
    ).toMatch(/webhook\.testUndelivered/);
  });

  it("exactly one test runs at a time per page", () => {
    const start = content.indexOf("async function handleTest(");
    const window = content.slice(start, start + 400);
    expect(
      window,
      "double-click stacks two test signatures on a slow endpoint",
    ).toMatch(/if \(testingId !== null\) return;/);
  });

  it("each webhook row renders its own settled verdict as a status message", () => {
    expect(
      content,
      "verdict has no plain-text per-row rendering",
    ).toMatch(/role="status"/);
    expect(
      content,
      "verdict lost its accessible name",
    ).toMatch(/aria-label=\{t\("webhook\.testVerdict"\)\}/);
    expect(
      content,
      "delivered and undelivered verdicts are not visually distinguished",
    ).toMatch(/testVerdicts\[webhook\.id\]\.delivered/);
    expect(
      content,
      "verdict falls back to the generic failure key when the backend sends no detail",
    ).toMatch(/testVerdicts\[webhook\.id\]\.error \?\? t\("webhook\.testFailed"\)/);
  });

  it("the dead-letter queue fetches on mount instead of rendering never-fetched as empty", () => {
    expect(
      content,
      "no mount seed: the queue reads empty until someone presses refresh",
    ).toMatch(/useEffect\(\(\) => \{\s*\n\s*void loadDeadLetters\(\);\s*\n\s*\}, \[workspaceId\]\);/);
    // The fetch itself must not wait on, or branch on, the role flag — the
    // render gate `{isAdmin && (` legitimately stays, as does the wave-17
    // comment explaining it. Match from the effect opening so the window
    // covers only the seed call, not the neighboring isAdmin comment.
    const seedStart = content.indexOf("void loadDeadLetters();");
    expect(seedStart, "mount seed effect was removed").toBeGreaterThan(-1);
    const effectOpen = content.lastIndexOf("useEffect(", seedStart);
    expect(effectOpen, "mount seed is not inside an effect").toBeGreaterThan(-1);
    const seedWindow = content.slice(effectOpen, seedStart);
    expect(
      seedWindow,
      "seed gated on the role read: role latency decides what the queue holds",
    ).not.toMatch(/isAdmin/);
    expect(
      content,
      "unfetched [] still renders the fetched-empty copy",
    ).toMatch(/!dlqFetched \|\| \(deadLetters\.length === 0 && !dlqError\)/);
    expect(
      content,
      "pending copy lost its i18n key",
    ).toMatch(/outbox\.dlqPendingDescription/);
    const start = content.indexOf("async function loadDeadLetters(");
    expect(start, "loadDeadLetters was renamed").toBeGreaterThan(-1);
    const window = content.slice(start, start + 600);
    expect(
      window,
      "fetched flag never settles: a failed load stays pending forever",
    ).toMatch(/setDlqFetched\(true\);/);
  });

  it("both locales carry the new verdict and pending keys", () => {
    for (const loc of ["en", "vi"] as const) {
      const dict = JSON.parse(
        readFileSync(join(__dirname, "..", "i18n", `${loc}.json`), "utf8"),
      );
      for (const key of [
        "webhook.testDelivered",
        "webhook.testUndelivered",
        "webhook.testVerdict",
        "outbox.dlqPendingDescription",
      ]) {
        const [ns, leaf] = key.split(".");
        expect(dict[ns][leaf], `${loc} lost ${key}`).toBeTruthy();
      }
    }
  });
});

describe("report exports download bytes, not parsed JSON (wave-32)", () => {
  const api = readFileSync(join(__dirname, "..", "lib", "api.ts"), "utf8");
  const reports = source("ReportsPage");

  it("binary downloads bypass api() and return response.blob()", () => {
    // api() ends every 2xx body with response.json(): a CSV/XLSX download
    // throws SyntaxError on its own bytes, and a JSON export still inits
    // a TypeError at createObjectURL (plain object, not a Blob). The
    // download helper must terminate on .blob() and surface !ok bodies
    // through the shared problem-details parser.
    const start = api.indexOf("export async function downloadBlob(");
    expect(start, "downloadBlob was renamed").toBeGreaterThan(-1);
    const end = api.indexOf("export function exportTasks(", start);
    const window = api.slice(start, end === -1 ? start + 1400 : end);
    expect(window, "download still parses the body as JSON").not.toMatch(
      /response\.json\(\)/,
    );
    expect(window, "download never resolves the body bytes").toMatch(
      /return response\.blob\(\);/,
    );
    expect(window, "download lost the shared error surfacing").toMatch(
      /throw await parseProblemDetails\(response\);/,
    );
  });

  it("both export entry points route through the blob downloader", () => {
    expect(api, "CSV/JSON export still asks api() to parse bytes").toMatch(
      /export function exportTasks\([\s\S]*?return downloadBlob\(/,
    );
    expect(api, "backup export still asks api() to parse bytes").toMatch(
      /export function exportProjectBackup\([\s\S]*?return downloadBlob\(/,
    );
    expect(
      api,
      "downloadBlob inherited the JSON default Content-Type, mislabelling header-only GETs",
    ).toMatch(/no default Content-Type/);
  });

  it("the export failure path names the generic failure key", () => {
    // The catch used to surface whatever the parser threw (SyntaxError text
    // on CSV bytes, TypeError text on the JSON shape). The button toast must
    // still fall back to reports.exportFailed for non-Error rejections.
    const start = reports.indexOf("async function handleExport(");
    expect(start, "handleExport was renamed").toBeGreaterThan(-1);
    const window = reports.slice(start, start + 900);
    expect(window, "export lost its object-URL download wiring").toMatch(
      /const blob = await exportTasks\(workspaceId, projectId, format\);/,
    );
    expect(window, "export lost its generic failure fallback").toMatch(
      /t\("reports\.exportFailed"\)/,
    );
  });
});

describe("ai accept routes to the exact card (wave-30)", () => {
  const panel = readFileSync(
    join(COMPONENTS, "ai", "AiAssistantPanel.tsx"),
    "utf8",
  );

  it("pendingAccepting is a (message, action) position, not a bare index", () => {
    expect(
      panel,
      "bare action index regressed: the same index exists in several messages at once",
    ).toMatch(
      /const \[pendingAccepting, setPendingAccepting\] = useState<\{\s*\n\s*message: number;\s*\n\s*action: number;\s*\n\s*\} \| null>\(null\);/,
    );
  });

  it("the last-message writer is gone; outcomes address prev[messageIndex]", () => {
    expect(panel, "replaceLastAction still exists").not.toMatch(
      /replaceLastAction/,
    );
    const start = panel.indexOf("function replaceAction(");
    expect(start, "replaceAction was renamed").toBeGreaterThan(-1);
    const window = panel.slice(start, start + 1200);
    expect(
      window,
      "outcome no longer lands on the exact card the user acted on",
    ).toMatch(/const target = prev\[messageIndex\];/);
    expect(
      window,
      "out-of-range write guard is gone",
    ).toMatch(/if \(actionIndex < 0 \|\| actionIndex >= actions\.length\) return prev;/);
  });

  it("handleAccept/handleReject take the message index and scope the in-flight card", () => {
    const acceptStart = panel.indexOf("async function handleAccept(");
    expect(acceptStart, "handleAccept was renamed").toBeGreaterThan(-1);
    const acceptWindow = panel.slice(acceptStart, acceptStart + 800);
    expect(
      acceptWindow,
      "handleAccept lost its message index",
    ).toMatch(
      /action: AiExecuteActionContract,\s*\n\s*messageIndex: number,\s*\n\s*actionIndex: number,/,
    );
    expect(
      acceptWindow,
      "in-flight marker regressed to a bare index",
    ).toMatch(/setPendingAccepting\(\{ message: messageIndex, action: actionIndex \}\);/);
    const rejectStart = panel.indexOf("function handleReject(");
    expect(rejectStart, "handleReject was renamed").toBeGreaterThan(-1);
    const rejectWindow = panel.slice(rejectStart, rejectStart + 400);
    expect(
      rejectWindow,
      "handleReject lost its message index",
    ).toMatch(/messageIndex: number, actionIndex: number/);
  });

  it("each message wires its own index into accept/reject and the accepting flag", () => {
    expect(
      panel,
      "onAccept no longer passes the message index — outcome lands on the last message",
    ).toMatch(/void handleAccept\(action, i, actionIndex\)/);
    expect(
      panel,
      "onReject no longer passes the message index",
    ).toMatch(/handleReject\(i, actionIndex\)/);
    expect(
      panel,
      "accepting flag regressed to a bare index shared by every message",
    ).toMatch(/pendingAccepting\?\.message === i/);
  });
});

describe("attachment calls hit the shared API base, not the Vercel SPA (wave-33)", () => {
  const api = readFileSync(join(__dirname, "..", "lib", "api.ts"), "utf8");
  const panel = readFileSync(
    join(COMPONENTS, "board", "TaskDetailPanel.tsx"),
    "utf8",
  );

  it("no root-relative /api/v1 attachment URL survives in api.ts", () => {
    // In dev a root-relative /api/v1 path still works (Vite proxies /api to
    // localhost:5217), but in prod it hits the Vercel SPA itself — vercel.json
    // rewrites /(.*) -> /index.html (probed HTTP 200 text/html on
    // /api/v1/ping). The upload XHR then posted index.html bytes and the
    // blob fetch painted index.html as a fake attachment.
    expect(
      api,
      'root-relative "/api/v1 attachment URL regressed — prod Vercel serves index.html for it',
    ).not.toMatch(/`\/api\/v1/);
    expect(
      api,
      "uploadTaskAttachment no longer routes through the shared BASE",
    ).toMatch(
      /export async function uploadTaskAttachment\([\s\S]*?\$\{BASE\}\/workspaces/,
    );
    expect(
      api,
      "getAttachmentObjectUrl no longer routes through the shared BASE",
    ).toMatch(
      /export async function getAttachmentObjectUrl\([\s\S]*?\$\{BASE\}\/workspaces/,
    );
  });

  it("the panel downloader resolves against API_BASE too", () => {
    expect(
      panel,
      "panel downloader regressed to a root-relative /api/v1 path",
    ).not.toMatch(/`\/api\/v1\/workspaces/);
    expect(
      panel,
      "panel downloader lost its shared-base wiring",
    ).toMatch(/\$\{API_BASE\}\/api\/v1\/workspaces/);
  });
});
