# 🚀 Sprint 30 — Webhook Admin UI, Watcher List, Security Fixes & Polish

**Status:** Planning
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint30-<feature>` (A/B) / `feat/frontend-sprint30-<feature>` (C/D)
**Updated:** 2026-08-25

---

## Why This Sprint

Sprint 29 merged (PRs #133, #142, #143, #144): file upload safety, settings PUT endpoints, bulk ops UI, settings edit UI, i18n completion, Dashboard UX fix. A survey of `origin/main` found the **highest-impact remaining gaps**:

1. **Webhook DLQ admin UI missing** — backend has `GET /outbox/dead-letter` + `POST /outbox/{id}/replay` (`OutboxController.cs`), but no frontend to inspect or retry dead-lettered messages. Admins are blind to webhook failures. *(P1 — operations visibility.)*
2. **Watcher list missing** — watch/unwatch exists (backend `WatchTaskCommand`/`UnwatchTaskCommand`/`IsWatchingTaskQuery`, frontend `TaskDetailPanel.tsx` toggle) but no UI shows *who* is watching a task. *(P2 — parity gap.)*
3. **Template scoping security gap** — `UpdateTemplateCommandHandler` does NOT verify `template.ProjectId == request.ProjectId`, allowing an Admin to modify a template from another project in the same workspace. *(P0 — authorization gap.)*
4. **README stale** — claims "50 unit tests" (actual: 301+), lists Burndown/Velocity/GitHub/Email/Bulk/Templates/Custom Fields as unchecked `[ ]` though all shipped. Misleading for contributors. *(Docs debt.)*
5. **Integration tests thin** — only 1 file (`AuthAndWorkspaceIntegrationTests.cs`), one register→workspace flow, skipped when Docker is down. No project/sprint/task end-to-end coverage. *(Test debt.)*
6. **EmptyState underused** — `components/ui/EmptyState.tsx` exists (Sprint 28) but 27 files still hand-roll `border-dashed` empty states. *(DRY.)*

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead)** | Backend security fix + docs + review | `feat/backend-sprint30-*` | A30.1 Template scoping fix + tests, A30.2 README/docs cleanup, A30.3 Review/merge B/C/D |
| **B (Backend)** | Watchers query + integration tests | `feat/backend-sprint30-*` | B30.1 `GetTaskWatchersQuery` + endpoint + unit tests, B30.2 `ProjectAndSprintIntegrationTests.cs` |
| **C (Frontend)** | Watcher list UI + DLQ admin UI | `feat/frontend-sprint30-*` | C30.1 Watcher list in `TaskDetailPanel.tsx`, C30.2 DLQ section on `WebhooksPage.tsx` |
| **D (Frontend + i18n)** | EmptyState adoption + DLQ i18n | `feat/frontend-sprint30-*` | D30.1 EmptyState in 5 pages, D30.2 outbox i18n keys en+vi |

---

## 🤖 Agent A — Template Scoping Fix + Docs (Team Lead)

### A30.1 — Template scoping security fix
**Files:** `src/DevFlow.Application/Features/Templates/Update/UpdateTemplateCommand.cs`, `tests/DevFlow.UnitTests/Features/Templates/UpdateTemplateCommandHandlerTests.cs`

**Problem:** `UpdateTemplateCommandHandler` validates the project belongs to the workspace (lines 32-36) but fetches the template by id (line 38) without checking `template.ProjectId == request.ProjectId`. An Admin could edit a template that belongs to a *different* project in the same workspace.

**Approach:** After fetching the template, add a project-scoping check mirroring `UpdateSprintCommandHandler` (lines 42-46):
```csharp
if (template.ProjectId != request.ProjectId)
{
    throw new NotFoundException(nameof(Domain.Entities.TaskTemplate), request.TemplateId);
}
```

**Tests (2 new, appended to the existing file):**
1. `Handle_ShouldThrowNotFound_WhenTemplateBelongsToDifferentProject` — template created with a foreign `projectId`, `GetByIdAsync` stubbed, expect `NotFoundException`.
2. `Handle_ShouldThrowNotFound_WhenTemplateProjectIdDiffersFromRequested` — template in the **same workspace but a different project** (proves the workspace-only check is insufficient).

**Acceptance criteria:**
- Cross-project template update returns 404 NotFound.
- In-scope template update still works.
- `dotnet build` + `dotnet test` green (301→303).

### A30.2 — README/docs cleanup
**Files:** `README.md`, `docs/sprint30/plan.md` (this file), `AGENT_STATUS.md`

**Approach:**
- `README.md` line 24: `xUnit (50 unit tests)` → `xUnit (303 unit tests)`.
- `README.md` roadmap lines 106-112: tick `[x]` for Burndown Charts, Velocity Metrics, GitHub Integration, Email Notifications, Bulk Operations, Task Templates, Custom Fields (all shipped).
- Add a "Next up: Sprint 30" list to the README roadmap.
- After merges, update `AGENT_STATUS.md`.

### A30.3 — Review & merge B/C/D PRs
- Review each PR, run `dotnet test` / `npm run build` + i18n parity, merge when green, update `AGENT_STATUS.md`.

---

## 🤖 Agent B — Watchers Query + Integration Tests

### B30.1 — `GetTaskWatchersQuery` + endpoint + unit tests
**Files:** `src/DevFlow.Application/Features/Tasks/Watch/GetTaskWatchersQuery.cs` (new), `src/DevFlow.Application/Common/Interfaces/ITaskWatcherRepository.cs` (add `GetByTaskAsync` if missing), `src/DevFlow.Api/Controllers/TasksController.cs`, `tests/DevFlow.UnitTests/Features/Tasks/GetTaskWatchersQueryHandlerTests.cs` (new)

**Problem:** Watch/unwatch exists but there is no query to list who watches a task.

**Approach:**
- **Query + DTO:**
```csharp
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskWatchersQuery(Guid WorkspaceId, Guid ProjectId, Guid TaskId)
    : IRequest<IReadOnlyList<TaskWatcherResponse>>, IWorkspaceRequest;

public sealed record TaskWatcherResponse(Guid UserId, string Username, string DisplayName);
```
- **Handler:** mirrors `IsWatchingTaskQueryHandler` — fetch task, validate null / `task.ProjectId != ProjectId` → `NotFoundException`, then `watcherRepository.GetByTaskAsync(taskId)`. Resolve display names in bulk via `userRepository.GetDisplayNamesAsync(userIds, ct)` (same pattern as `ListActivitiesQueryHandler` — avoids N+1).
- **`ITaskWatcherRepository`:** ensure `GetByTaskAsync(Guid taskId, CancellationToken ct)` returns `Task<List<TaskWatcher>>`. Add if missing (watch for it in `TaskWatcherRepository`).
- **Endpoint** in `TasksController.cs`:
```csharp
[HttpGet("{taskId:guid}/watchers")]
[ProducesResponseType(typeof(IReadOnlyList<TaskWatcherResponse>), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<IActionResult> GetWatchers(Guid workspaceId, Guid projectId, Guid taskId, CancellationToken ct)
```
Route: `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/watchers`.

**Unit tests (≥4):**
- Happy path — task exists, 2 watchers, returns list with display names.
- No watchers — task exists, returns empty list.
- Task not found → `NotFoundException`.
- Task belongs to different project → `NotFoundException` (scoping).

### B30.2 — `ProjectAndSprintIntegrationTests.cs`
**Files:** `tests/DevFlow.IntegrationTests/ProjectAndSprintIntegrationTests.cs` (new)

**Approach:** Mirror `AuthAndWorkspaceIntegrationTests.cs` exactly — `IClassFixture<DevFlowWebApplicationFactory>`, `HttpClient client = factory.CreateClient()`, `if (!DevFlowWebApplicationFactory.IsDockerAvailable) return;` skip pattern, throw-with-response-body helper. Flow: register → login (set `Authorization` header) → create workspace → create project → create sprint → create task → PATCH task to `InProgress` → verify status. Use `PostAsJsonAsync` / `ReadFromJsonAsync<JsonElement>` with real request shapes (`CreateProjectRequest(name,key,description)`, `CreateSprintRequest(name,goal)`, `CreateTaskItemRequest(title,description,priority,dueDateUtc)`).

**Acceptance criteria:**
- New flow passes when Docker + Postgres are available.
- Same skip-when-no-Docker guard as the existing test.
- `dotnet test` green with and without Docker.

---

## 🎨 Agent C — Watcher List UI + DLQ Admin UI

### C30.1 — Watcher list in `TaskDetailPanel.tsx`
**Files:** `frontend/src/types/api.ts`, `frontend/src/lib/api.ts`, `frontend/src/components/board/TaskDetailPanel.tsx`

**Problem:** A task's watchers exist in the DB but are invisible; only the current user's watch state shows.

**Approach:**
- `types/api.ts`: `interface TaskWatcherResponse { userId: string; username: string; displayName: string; }`.
- `api.ts`: `getTaskWatchers(workspaceId: string, projectId: string, taskId: string): Promise<TaskWatcherResponse[]>`.
- `TaskDetailPanel.tsx`: add `watchers`/`watchersLoading` state; fetch in a `useEffect` keyed on `task.id` beside the existing `isWatchingTask` effect (lines ~92-105). Render a "Watchers" row after the assignee select: stacked `Avatar`s (`name={w.displayName || w.username}`, `id={w.userId}`, `size="sm"`) + names, with `t("task.watcherCount", { count })`. Refetch after `toggleWatch`. No remove UI (keep minimal).

### C30.2 — DLQ admin UI on `WebhooksPage.tsx`
**Files:** `frontend/src/pages/WebhooksPage.tsx`, `frontend/src/types/api.ts`, `frontend/src/lib/api.ts`

**Problem:** Dead-lettered webhook messages exist server-side but there is no UI to inspect/retry them.

**Approach:**
- **Where:** new section **below** the existing webhook list on the workspace-level webhooks page — reuses the page's own `formatDate`, loading/error skeleton, Admin-gating (`workspace.role`). No new route, no `App.tsx` change.
- `types/api.ts`: `interface DeadLetterMessageDto { id: string; type: string; occurredAtUtc: string; processedAtUtc?: string; retryCount: number; error?: string; failedPermanentlyAt: string; }`.
- `api.ts`:
```ts
export function getDeadLetterMessages(workspaceId: string, batchSize = 100): Promise<DeadLetterMessageDto[]>
export async function replayDeadLetterMessage(workspaceId: string, messageId: string): Promise<void>
```
- **UI:** heading `t("outbox.dlqTitle")` + description; list rows: Type (mono), Error (truncate + title tooltip), retry-count badge, occurred-at + failed-permanently-at via `formatDate`, per-row **Replay** button with `replayingId` loading state (same `testingId` pattern already on the page). Toast on success/failure, reload after replay. Empty state → `<EmptyState icon={...} title={t("outbox.dlqEmpty")} description={t("outbox.dlqDescription")} />`. Admin-only section.
- **No i18n keys here** — D30.2 owns `outbox.*`.

**Acceptance criteria:**
- DLQ section lists dead-lettered messages with error + retries + timestamps.
- Replay re-queues a message, shows toast, reloads the list.
- Section hidden for non-Admin users.
- `npm run build` green.

---

## 🚀 Agent D — EmptyState Adoption + DLQ i18n

### D30.1 — EmptyState adoption in 5 pages
**Files:** `frontend/src/pages/ActivitiesPage.tsx`, `frontend/src/pages/BoardPage.tsx`, `frontend/src/pages/CustomFieldsPage.tsx`, `frontend/src/pages/GitHubPage.tsx`, `frontend/src/pages/MyTasksPage.tsx`

**Approach:** Replace hand-rolled `border-dashed` empty-state markup with the existing `<EmptyState>` component (`components/ui/EmptyState.tsx` — props `{ icon, title, description?, action? }`). Preserve icons, i18n keys, and action buttons exactly — only the wrapper markup changes. Import from `../../components/ui/EmptyState` (adjust relative path). No new i18n keys. Do NOT touch the other 21 `border-dashed` files (deferred to Sprint 31+).

### D30.2 — DLQ i18n keys (en + vi)
**Files:** `frontend/src/i18n/en.json`, `frontend/src/i18n/vi.json`

Add new top-level `outbox` section to BOTH files (values translated to Vietnamese in `vi.json`, keys/placeholders intact):
```json
"outbox": {
  "dlqTitle": "Dead Letter Queue",
  "dlqDescription": "Webhook messages that failed permanently after all retries. Inspect and replay them.",
  "dlqEmpty": "No dead-lettered messages",
  "dlqLoadFailed": "Failed to load dead-letter queue",
  "type": "Type",
  "error": "Error",
  "retryCount": "Retries",
  "occurredAt": "Occurred",
  "failedPermanentlyAt": "Failed permanently",
  "replay": "Replay",
  "replaying": "Replaying...",
  "replaySuccess": "Message re-queued for retry",
  "replayFailed": "Failed to re-queue message",
  "adminOnly": "Admin only"
}
```

**Acceptance criteria:**
- `outbox.*` keys present in both files.
- i18n parity test green.

---

## 🧭 Deferred to Sprint 31+

- **Project-level member management / RBAC** — needs new `ProjectMember` entity + migration; full design sprint.
- **Full EmptyState adoption** — the remaining 21 `border-dashed` files.
- **tsvector search ranking** — beyond ILIKE; revisit if search UX demands it.
- **Component library catalog / design sync.**
- **Time-tracking reporting** — `GetTeamReportTrends` placeholder.
- **Epic-to-epic dependencies** — beyond task-level dependency graph.
- **Custom field grouping/sectioning** — organize fields on task detail.
- **Outbox admin batch replay / "replay all".**

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys (add to BOTH `en.json` and `vi.json`).
- Shared files single-agent lock: `api.ts` (C only this sprint), `types/api.ts` (C only), `i18n/*.json` (D only), `TasksController.cs` (B only), `WebhooksPage.tsx` (C only).
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 30)

- [ ] A30.1 Template scoping fix + 2 unit tests (301→303), backend gate green
- [ ] A30.2 README counts/roadmap ticked + `docs/sprint30/plan.md` + AGENT_STATUS.md
- [ ] A30.3 Review & merge B/C/D PRs; AGENT_STATUS.md → Sprint 30 Complete
- [ ] B30.1 `GetTaskWatchersQuery` + `GET /tasks/{taskId}/watchers` + unit tests
- [ ] B30.2 `ProjectAndSprintIntegrationTests.cs` flow + Docker guard
- [ ] C30.1 Watcher list in `TaskDetailPanel` + `getTaskWatchers`
- [ ] C30.2 DLQ section on `WebhooksPage` + replay
- [ ] D30.1 EmptyState in 5 files, `npm run build` green
- [ ] D30.2 outbox i18n keys en+vi, i18n parity green

---

## After Approval (execution)

1. Write `docs/sprint30/prompts/prompt-{B,C,D}.md`.
2. Update `AGENT_STATUS.md` (Sprint 29 → Complete; Sprint 30 row with A30.1-3, B30.1-2, C30.1-2, D30.1-2).
3. Commit + push plan to main, open PR (Agent A planning/review only).
4. Begin A30.1 (template scoping fix) on `feat/backend-sprint30-template-scoping`, then review B/C/D PRs as they land.
