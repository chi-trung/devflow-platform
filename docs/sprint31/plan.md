# 🚀 Sprint 31 — Project-Level RBAC, Outbox Admin Batch, EmptyState Sweep & Depth Polish

**Status:** Planning
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint31-<feature>` (A/B) / `feat/frontend-sprint31-<feature>` (C/D)
**Updated:** 2026-08-25

---

## Why This Sprint

Sprint 30 merged (PRs #145–#148): template scoping security fix, watcher query/UI, DLQ admin UI, integration test expansion, EmptyState adoption in 5 pages. A read-only survey of `origin/main` found the **highest-impact remaining gaps**:

1. **Project-level RBAC missing (P0 — access model gap).** Access control is **workspace-only** today: a `WorkspaceMember` (Owner/Admin/Member) gets the same role in every project of the workspace. Jira/Linear model permission at the project level — an admin should be able to grant an extra person access to one project, or restrict a contractor to a single project. There is no `ProjectMember` entity, no per-project role, and no API to manage it.
2. **Outbox admin lacks batch operations (P1 — operations visibility).** Single-message replay exists (A28.1 + C30.2 UI). Admins cannot **replay all** or **purge** dead-lettered messages — the DLQ only ever shrinks one message at a time.
3. **EmptyState adoption incomplete (P2 — consistency).** Sprint 30 covered 5 pages; **22 files** still hand-roll `border-dashed` empty states (pages + dashboard/reporting/sprint/epic components). The single-`<EmptyState>`-component look is now the house style — the stragglers read as unfinished.
4. **Epic-to-epic dependencies missing (P2 — hierarchy gap).** Tasks have `TaskDependency` (Sprint 18) and epics have progress + roadmap, but epics cannot block each other. An epic `[Blocked]` by another epic has nowhere to live.
5. **Custom-field grouping UX missing (P3 — admin polish).** Custom fields are a flat list in `CustomFieldsPage`; no drag-to-group, no section headers.
6. **README/docs stale.** AGENT_STATUS lists Sprint 30 as In Progress (pre-merge snapshot); README roadmap needs Sprint 30 ticked and Sprint 31 queued.

**Deferred (verified NOT blocking):** `GetTeamReportTrends` is already implemented (no placeholder — checked), OAuth `#` password placeholder is intentional (commented). Project import/export already covers tasks/subtasks/epics/labels/custom fields. tsvector search ranking remains deferred (beyond ILIKE).

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead)** | Project-level RBAC entity + endpoints | `feat/backend-sprint31-*` | A31.1 ProjectMember entity + migration + repository; A31.2 Project member CQRS endpoints; A31.3 Review/merge B/C/D + AGENT_STATUS |
| **B (Backend)** | Outbox batch + epic deps + RBAC authorization guard | `feat/backend-sprint31-*` | B31.1 Outbox batch replay-all + purge; B31.2 Epic-to-epic dependency CQRS; B31.3 Project-level authorization guard + tests |
| **C (Frontend)** | Project member UI + DLQ batch actions | `feat/frontend-sprint31-*` | C31.1 Project settings member management; C31.2 DLQ Replay-all/Purge buttons |
| **D (Frontend + i18n)** | EmptyState sweep + epic deps UI + i18n | `feat/frontend-sprint31-*` | D31.1 EmptyState adoption (remaining ~20 files); D31.2 Epic dependency UI + i18n |

---

## 🤖 Agent A — Project-Level RBAC: Entity + Endpoints (Team Lead)

### A31.1 — `ProjectMember` entity + migration + repository
**Files:** `src/DevFlow.Domain/Entities/ProjectMember.cs` (new), `src/DevFlow.Infrastructure/Persistence/Configurations/ProjectMemberConfiguration.cs` (new), `src/DevFlow.Infrastructure/Persistence/DevFlowDbContext.cs`, EF migration, `src/DevFlow.Application/Common/Interfaces/IProjectMemberRepository.cs` (new)

**Entity** (mirror `WorkspaceMember` shape):
```csharp
public class ProjectMember : BaseEntity, IAuditableEntity
{
    public Guid ProjectId { get; private set; }
    public Guid UserId { get; private set; }
    public ProjectRole Role { get; private set; }
    // ProjectRole enum: Member | Manager (new file src/DevFlow.Domain/Enums/ProjectRole.cs)
}
```
- Unique index `(ProjectId, UserId)`.
- `Create(Guid projectId, Guid userId, ProjectRole role)` factory + `UpdateRole(ProjectRole)`.
- Repository: `GetByProjectAsync`, `GetByUserInWorkspaceAsync`, `AddAsync`, `RemoveAsync`, `ExistsAsync`, `UpdateAsync` (mirror `IWorkspaceMemberRepository` if one exists, else model on `ITaskWatcherRepository`).

**Acceptance:** Migration up/down symmetric; `dotnet build` + `dotnet test` green (≥2 entity/repo tests).

### A31.2 — Project member CQRS endpoints
**Files:** `src/DevFlow.Application/Features/ProjectMembers/` (new: AddProjectMemberCommand, RemoveProjectMemberCommand, UpdateProjectMemberRoleCommand, ListProjectMembersQuery), `src/DevFlow.Api/Controllers/ProjectMembersController.cs` (new)

**Routes:**
```
GET    /api/v1/workspaces/{workspaceId}/projects/{projectId}/members
POST   /api/v1/workspaces/{workspaceId}/projects/{projectId}/members   { userId, role }
PATCH  /api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{userId}  { role }
DELETE /api/v1/workspaces/{workspaceId}/projects/{projectId}/members/{userId}
```
- Guarded `[RequireWorkspaceRole(Admin)]` for mutate; `Member` for list.
- Response: `ProjectMemberResponse(Guid UserId, string Username, string DisplayName, string Role)` — resolve names via `userRepository.GetByIdsAsync` (Sprint 30 addition).
- **Invariant:** a user must already be a workspace member to be added to a project (enforce in handler); removing a project member does not remove them from the workspace.

**Acceptance:** ≥4 unit tests (add, remove, update-role, list, cross-workspace NotFound). 303 → 30x tests.

### A31.3 — Review & merge B/C/D PRs
- Review each PR, run `dotnet test` / `npm run build` + i18n parity, merge when green.
- Update `AGENT_STATUS.md` after all merges.

---

## 🤖 Agent B — Outbox Batch + Epic Dependencies + RBAC Guard

### B31.1 — Outbox batch replay-all + purge
**Files:** `src/DevFlow.Application/Features/Outbox/` (extend), `src/DevFlow.Infrastructure/Persistence/Repositories/OutboxRepository.cs`, `src/DevFlow.Api/Controllers/OutboxController.cs`

**Commands/endpoints (Admin-gated):**
```
POST /api/v1/workspaces/{workspaceId}/outbox/dead-letter/replay-all
DELETE /api/v1/workspaces/{workspaceId}/outbox/dead-letter
```
- `ReplayAllOutboxMessagesCommand` — reset retry state on all dead-lettered messages for the workspace (reuse `ResetRetryAsync`; batch version).
- `PurgeDeadLetterMessagesCommand` — hard-delete all dead-lettered messages for the workspace.
- Response for replay-all: count of re-queued messages (`ReplayAllResponse(int Requeued)`).

**Acceptance:** ≥3 unit tests (replay-all resets batch, purge deletes batch, empty list is a no-op).

### B31.2 — Epic-to-epic dependencies
**Files:** `src/DevFlow.Domain/Entities/EpicDependency.cs` (new) OR extend `Epic` with a `DependentEpicIds`/dependency table, EF migration, `IEpicDependencyRepository` (new), `src/DevFlow.Application/Features/Epics/` (AddEpicDependencyCommand, RemoveEpicDependencyCommand, ListEpicDependenciesQuery), `src/DevFlow.Api/Controllers/EpicsController.cs`

**Model choice:** separate `EpicDependency` join entity (`EpicId`, `BlockedById`) with unique `(EpicId, BlockedById)`, mirroring `TaskDependency`. No cycle enforcement needed at MVP (document it) — or add a simple depth-check; prefer the TaskDependency pattern for consistency.

**Endpoints:**
```
GET    /api/v1/workspaces/{workspaceId}/projects/{projectId}/epics/{epicId}/dependencies
POST   .../epics/{epicId}/dependencies   { blockedByEpicId }
DELETE .../epics/{epicId}/dependencies/{blockedByEpicId}
```
- `EpicResponse` gains optional `blockedByEpicIds: Guid[]` (append to existing response record — additive, frontend tolerant).

**Acceptance:** ≥4 unit tests (add, remove, list, cross-project NotFound).

### B31.3 — Project-level authorization guard + tests
**Files:** `src/DevFlow.Application/Common/Authorization/IProjectRequest.cs` (new), `src/DevFlow.Application/Common/Behaviors/ProjectAuthorizationBehavior.cs` (new), `src/DevFlow.Application/Common/Authorization/RequireProjectRoleAttribute.cs` (new), DI registration in `src/DevFlow.Api/Program.cs`

**Approach:** add an OPTIONAL authorization path layered on the existing workspace behavior:
- `IProjectRequest : IWorkspaceRequest` + `Guid ProjectId`.
- `[RequireProjectRole(ProjectRole.Manager)]` attribute — applied only to project-member commands (A31.2).
- `ProjectAuthorizationBehavior` — for requests implementing `IProjectRequest`, look up `ProjectMember`; if the user is a project member, their project role must meet the minimum; otherwise fall through to workspace role (so Owner/Admin still passes everywhere).

**Acceptance:** `dotnet test` green; RbacAuthorizationTests extended with project-scoped cases.

---

## 🎨 Agent C — Project Member UI + DLQ Batch Actions

### C31.1 — Project settings member management
**Files:** `frontend/src/pages/ProjectSettingsPage.tsx` (find or create), `frontend/src/lib/api.ts` (add `getProjectMembers`/`addProjectMember`/`updateProjectMemberRole`/`removeProjectMember`), `frontend/src/types/api.ts` (add `ProjectMemberResponse`), `frontend/src/i18n/en.json` + `vi.json` (new `projectMember.*` keys)

**UI:** On the project settings page, a "Members" section mirroring WorkspacePage's member list:
- Table/list: avatar + display name + username + role badge (Member/Manager) + role dropdown (Manager-gated).
- Add-member: user search/dropdown of workspace members NOT already in the project + role picker + Add button.
- Remove: trash button with confirm dialog (can't remove self / workspace Owner).
- **Lock `api.ts`/`types/api.ts` with D** (both touch them — coordinate).

### C31.2 — DLQ Replay-all / Purge buttons
**Files:** `frontend/src/pages/WebhooksPage.tsx`, `frontend/src/lib/api.ts` (add `replayAllDeadLetterMessages`/`purgeDeadLetterMessages`), `frontend/src/types/api.ts`

- Extend the DLQ section header (currently has just Refresh) with two buttons: **Replay all** and **Purge** (destructive → ConfirmDialog).
- Loading state per action; toast `outbox.replayAllSuccess`/`outbox.purgeSuccess` (D owns i18n keys — see D31.2).
- Reload list after either action.

---

## 🚀 Agent D — EmptyState Sweep + Epic Dependency UI + i18n

### D31.1 — EmptyState adoption (remaining ~20 files)
**Files:** the 22 `border-dashed` files NOT touched in Sprint 30. Pages first, then shared components:
- Pages: `DashboardPage.tsx`, `EpicsPage.tsx`, `LabelsPage.tsx`, `SprintPlanningPage.tsx`, `TemplatesPage.tsx`, `WorkspacePage.tsx`, `WebhooksPage.tsx` (the non-DLQ empty state at line ~288), `BoardPage.tsx` (any remaining).
- Components: `SprintHealthCard.tsx`, `CumulativeFlow.tsx`, `TeamPerformancePanel.tsx`, `BurndownChartApi.tsx`, `CycleLeadTimeChart.tsx`, `TeamReportCards.tsx`, `VelocityChart.tsx`, `VelocityTrendChart.tsx`, `BurndownChart.tsx`, `EpicRoadmap.tsx`, `SprintBoard.tsx`, `Column.tsx` (drop-target + empty column), `ImportTasksModal.tsx`, `ExportImportModal.tsx`.

**Rules:** preserve icon/i18n keys/action buttons EXACTLY; only wrapper markup changes. Empty states that are NOT semantically "empty list" (e.g. `Column.tsx` drop-target, `EpicRoadmap` today-line) — skip those, they're layout, not empty-state. Do NOT touch `EmptyState.tsx` itself.

**Acceptance:** `npm run build` green; no visual regression (same dashed look, same spacing).

### D31.2 — Epic dependency UI + i18n
**Files:** `frontend/src/pages/EpicsPage.tsx`, `frontend/src/components/epic/EpicRoadmap.tsx` (optional), `frontend/src/lib/api.ts` (add `getEpicDependencies`/`addEpicDependency`/`removeEpicDependency`), `frontend/src/types/api.ts` (add `EpicDependencyResponse`), `frontend/src/i18n/en.json` + `vi.json`

- On the epic detail/modal: "Blocked by" section — list blocking epics (clickable), add-blocker picker (epic dropdown), remove (X). Badge on epic cards when blocked.
- **i18n keys:** also add the `outbox.*` batch-action keys for C31.2 (`replayAll`/`purge`/`replayAllSuccess`/`purgeSuccess`/`purgeConfirm`), both en + vi.

**Acceptance:** `npm run build` + i18n parity green.

---

## 🧭 Deferred to Sprint 32+

- **Full ProjectMember UI polish** (per-project role matrix, bulk assign).
- **Epic dependency cycle detection** beyond MVP.
- **tsvector search ranking** — beyond ILIKE.
- **Component library catalog / design sync.**
- **Time-tracking reporting** depth (trends by member across projects).
- **Custom field grouping UI** (drag-to-group).
- **Outbox per-message detail view** / redelivery log.

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys (add to BOTH `en.json` and `vi.json`).
- Shared files single-agent lock: `api.ts` (C adds project-member + DLQ-batch fns, D adds epic-dep fns — coordinate or split by merge order), `types/api.ts` (same), `i18n/*.json` (D owns epic + outbox-batch keys), `TasksController.cs`/`OutboxController.cs` (B only), `EpicsController.cs` (B only).
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 31)

- [ ] A31.1 ProjectMember entity + migration + repository
- [ ] A31.2 Project member CQRS endpoints + tests
- [ ] A31.3 All PRs reviewed/merged; AGENT_STATUS updated
- [ ] B31.1 Outbox replay-all + purge endpoints + tests
- [ ] B31.2 Epic-to-epic dependency CQRS + tests
- [ ] B31.3 Project authorization guard + tests
- [ ] C31.1 Project member management UI
- [ ] C31.2 DLQ Replay-all/Purge UI
- [ ] D31.1 EmptyState adoption in remaining files, build green
- [ ] D31.2 Epic dependency UI + i18n parity green
