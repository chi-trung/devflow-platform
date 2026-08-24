# 🚀 Sprint 26 — Performance & Data Integrity Hardening

**Status:** Planning → Ready for Agents A/B/C/D
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint26-<feature>` (Agent A, Codebuff) / `feat/frontend-sprint26-<feature>` (Agent C/D, OpenCode)
**Updated:** 2026-08-24

---

## Why This Sprint

Sprint 25 landed (PRs #109–116): RBAC hardening, presence fix, task watchers, activity transparency, notification overhaul. A full read-only gap survey of backend (377 source files), infra/CI, and frontend (114 files, manual) surfaced the **next real problems** — not missing features but **shallow/incomplete implementations** that will bite as the product scales:

1. **Dashboard & search are O(N) in-memory LINQ with N+1 queries** — the two most-used pages degrade as workspaces grow.
2. **Notification preferences only gate 3 email paths** — the global `NotificationBehavior` creates in-app notifications for *every* event type with no mute, and events like `RoleChanged`/`RemovedFromWorkspace` have no toggle at all.
3. **Outbox retries forever on poison messages** with zero observability — a permanently-failing webhook never stops.
4. **No soft-delete anywhere** — all deletes are hard, archived projects are unrecoverable, sprints can't be deleted at all.
5. **Task watchers exist on the backend but have NO frontend UI** — users can't actually watch tasks.
6. **CI has no safety rails** — auto-merge merges on PR open with no required checks/reviews, integration tests silently pass, no frontend tests, no lint.

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead — me)** | Backend perf + correctness | `feat/backend-sprint26-*` | A26.1 Dashboard rewrite, A26.2 Outbox DLQ, A26.3 Sprint delete, A26.4 Review/merge B/C/D |
| **B (Backend)** | Backend robustness | `feat/backend-sprint26-*` | B26.1 Unified notification preferences, B26.2 Soft-delete + archive-restore |
| **C (Frontend)** | Frontend — watchers UI + dashboard | `feat/frontend-sprint26-*` | C26.1 Task watcher UI, C26.2 Dashboard activity actor names + empty states |
| **D (Frontend + Infra)** | Frontend polish + CI safety | `feat/frontend-sprint26-*` | D26.1 Frontend tests + Vitest setup, D26.2 Auto-merge safety + integration tests in CI |

> **Rule:** Each agent stays in its own scope. Shared files (`api.ts`, `package.json`, `Program.cs`, `AppShell.tsx`) require a single-agent lock.

---

## 🔬 Priority-Ordered Gaps (source: read-only survey, verified on main)

| # | Gap | Severity | Status |
|---|---|---|---|
| 1 | Dashboard N+1 + unbounded load + blank actor names (`GetDashboardQueryHandler.cs`) | P0 | **A26.1** |
| 2 | Global search is in-memory LINQ + N+1 + no pagination (`SearchQueryHandler.cs`) | P0 | Deferred to S27 (needs design: ILike/tsvector) |
| 3 | Notification prefs ignored by pipeline; 3 of ~8 event types have toggles; no in-app mute | P1 | **B26.1** |
| 4 | Outbox no retry cap / no DLQ; webhook failures swallowed | P1 | **A26.2** |
| 5 | No soft-delete / no archive-restore (archived projects stuck) | P1 | **B26.2** |
| 6 | No DB backup/restore mechanism | P1 | Deferred (ops, not code) |
| 7 | Activity log filter/pagination | P1 | ✅ DONE — D25.1 (on main) |
| 8 | Email templates limited to 3 events | P2 | Covered in B26.1 |
| 9 | Test coverage gaps (Dashboard, WebhookDispatcher HMAC, Outbox retry, burndown/CFD) | P2 | Rolled into each task's AC |
| 10 | No sprint DELETE endpoint | P2 | **A26.3** |
| 11 | No project-level member management | P2 | Deferred (design question) |
| 12 | Task watchers backend exists, NO frontend UI | P0 (UX) | **C26.1** |
| 13 | Auto-merge with no required checks; integration tests silently pass; no FE tests/lint | P0 (process) | **D26.1 + D26.2** |

---

## 🤖 Agent A — Backend Performance & Correctness

### A26.1 — Dashboard single-query aggregation + actor resolution
**File:** `src/DevFlow.Application/Features/Dashboard/GetDashboardQueryHandler.cs`

**Problem:** Loops every project calling `GetForProjectAsync` (N+1), concatenates all tasks unbounded, resolves activity actor names as `""`.

**Approach:**
- Replace the per-project loop with a single batch fetch. Verify whether `ITaskItemRepository` has a `GetForProjectsAsync` / batch method; if not, add one (or a dedicated dashboard repo query) that pulls tasks for all project IDs in one EF query.
- Cap the in-memory aggregation (e.g., only counts + deadlines need full set; recent activity caps at 5/project already).
- Resolve `ActivityItem.ActorName` via `IUserRepository.GetDisplayNamesAsync(actorIds)` — exactly the pattern already used in `ListActivitiesQueryHandler.cs` (on main).

**Acceptance criteria:**
- Dashboard loads all projects with a bounded number of DB queries (≤2 query patterns, no per-project loop).
- `recentActivity` shows real actor names, fallback `"Someone"`.
- No regression in existing dashboard tests; add a handler test asserting actor name resolution + aggregation correctness.
- `dotnet build` + `dotnet test` green.

### A26.2 — Outbox dead-letter / retry cap
**Files:** `src/DevFlow.Infrastructure/Persistence/Repositories/OutboxRepository.cs`, `src/DevFlow.Infrastructure/Background/OutboxProcessor.cs` (verify exact path), `src/DevFlow.Application/Common/Interfaces/IOutboxRepository.cs`

**Problem:** `GetUnprocessedAsync` filters only `ProcessedAtUtc == null` — a permanently-failing webhook retries forever (exponential backoff), never DLQs. `WebhookDispatcher` swallows failures with `catch {}`.

**Approach:**
- Add `MaxRetries` (e.g., 10) constant + `RetryCount`/`FailedPermanentlyAt` fields to `OutboxMessage` (entity + migration).
- `GetUnprocessedAsync` excludes messages past `MaxRetries` or marked failed-permanently.
- `OutboxProcessor` marks `FailedPermanently` when retries exhausted; logs per-attempt error (no more silent `catch {}`).

**Acceptance criteria:**
- A poison message stops retrying after `MaxRetries`, is marked failed, and doesn't block the queue.
- Unit tests: retry-cap behavior + webhook delivery error logging.
- `dotnet build` + `dotnet test` green.

### A26.3 — Sprint deletion endpoint
**File:** `src/DevFlow.Api/Controllers/SprintsController.cs` + CQRS command

**Problem:** Sprints can be created/completed/archived/rolled-over but **never deleted**.

**Approach:**
- `DELETE /api/v1/workspaces/{wsId}/projects/{projId}/sprints/{sprintId}` → 204 (404 if not found; 403 for non-Admin).
- Cascade: tasks in the deleted sprint return to backlog (set `SprintId = null`), activity log entry written.
- `[RequireWorkspaceRole(WorkspaceRole.Admin)]` (matches DeleteTask/DeleteEpic hardening from A25.1).

**Acceptance criteria:**
- Admin can delete a sprint; tasks move to backlog; Member gets 403.
- Unit tests for the command handler.
- `dotnet build` + `dotnet test` green.

### A26.4 — Review & merge B/C/D PRs
- As team lead: review all B/C/D PRs against AC, run `dotnet test` / `npm run build`, merge when green.

---

## 🤖 Agent B — Backend Notification & Data Integrity

### B26.1 — Unified notification preferences engine
**Files:** `src/DevFlow.Application/Common/Behaviors/NotificationBehavior.cs`, `src/DevFlow.Domain/Entities/NotificationPreferences.cs`, `src/DevFlow.Application/Features/Users/NotificationPreferences/`, `src/DevFlow.Application/Features/Email/EmailService.cs`

**Problem:** `NotificationBehavior` (the cross-cutting pipeline that creates in-app notifications for every `INotificationEvent`) never checks preferences. Prefs only gate 3 email paths via inline checks (`UpdateTaskItemCommandHandler`, `CreateCommentCommandHandler`). Events like `RoleChanged`, `RemovedFromWorkspace`, `StatusChanged`, `CommentAdded` have no email template AND no mute toggle. Result: users can't truly mute categories, and disabling `EmailOnAssignment` still spams in-app notifications.

**Approach:**
- **Scope decision required from team lead (below).** Two valid designs:
  - **(a) In-app mute:** add `InAppEnabled` toggles (mirroring the 3 email toggles) and have `NotificationBehavior` skip creating the in-app notification when muted.
  - **(b) Email-first completion:** keep in-app always-on, but round out email templates + toggles for the missing event types (`StatusChanged`, `CommentAdded`, `RoleChanged`, `RemovedFromWorkspace`, `SprintStarted` gate).
- Either way: `NotificationBehavior` must inject `INotificationPreferencesRepository` and check prefs before persisting a notification / sending email.
- Add a `EmailOnSprintStarted` gate check to `StartSprintCommandHandler` if missing (verify — the agent flagged it as likely ungated).

**Acceptance criteria:**
- Disabling a category stops BOTH the in-app notification and the email for that event type.
- No duplicate email (the inline `EmailOnAssignment`/`EmailOnMention` checks must not double-send once the pipeline gates it).
- Existing `NotificationPreferences` tests still pass; add tests for the pipeline gating.
- `dotnet build` + `dotnet test` green.

### B26.2 — Soft-delete + archive-restore
**Files:** `src/DevFlow.Domain/Entities/*.cs` (add `DeletedAtUtc`), `src/DevFlow.Infrastructure/Persistence/Interceptors/` (soft-delete interceptor), `src/DevFlow.Application/Features/Projects/ArchiveProjectCommand.cs` (+ new `RestoreProjectCommand`), controllers for Tasks/Workspaces/Webhooks

**Problem:** Grep for `DeletedAt|IsDeleted|SoftDelete` = 0 matches. All deletes are hard. Projects have `ArchiveProjectCommand` but no restore — archived projects are stuck forever.

**Approach:**
- Add `DeletedAtUtc` nullable to core entities (TaskItem, Project, Webhook, Workspace — decide scope with team lead).
- EF Core global query filter `IsDeleted` / `DeletedAtUtc == null` + soft-delete interceptor on `SaveChangesAsync`.
- New `RestoreProjectCommand` + `POST .../projects/{id}/restore` endpoint. Archive → sets `ArchivedAtUtc`, restore clears it.
- Verify whether `IUnitOfWork`/`SaveChangesAsync` already hooks interceptors (AuditableEntityInterceptor exists — reuse the pattern).

**Acceptance criteria:**
- Deleting a task/project sets `DeletedAtUtc` instead of removing the row; reads filter it out.
- Archived projects can be restored via API.
- Existing delete tests updated (hard-delete assertions → soft-delete); new restore tests.
- `dotnet build` + `dotnet test` green.

---

## 🤖 Agent C — Frontend Watchers UI + Dashboard

### C26.1 — Task watcher UI (backend EXISTS on main, frontend missing)
**Backend already on main:** `PUT/DELETE/GET .../tasks/{taskId}/watch` in `TasksController.cs`, CQRS (`WatchTaskCommand`, `UnwatchTaskCommand`, `IsWatchingTaskQuery`), `TaskWatcher` entity, migration `AddTaskWatchers`.

**Files (frontend, all on main):** `frontend/src/components/board/TaskDetailPanel.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, `frontend/src/i18n/en.json` + `vi.json`

**Approach:**
- Add watch/unwatch button + watching state to `TaskDetailPanel.tsx` (eye icon toggle, mirrors watcher UX in Jira/Linear).
- `api.ts`: `watchTask(wsId, projId, taskId)`, `unwatchTask(...)`, `isWatchingTask(...)`.
- On task open, fetch `IsWatchingTaskQuery`; toggle calls the right endpoint.
- i18n keys in both `en.json` and `vi.json` (100% parity — verify no missing keys).

**Acceptance criteria:**
- Eye toggle shows current watching state, toggles watch/unwatch, persists.
- `npm run build` (tsc strict) green; i18n parity check (both files have all new keys).

### C26.2 — Dashboard activity actor names + empty states
**File:** `frontend/src/pages/DashboardPage.tsx` (and any activity-rendering child)

**Problem:** Backend A26.1 resolves actor names; frontend currently may fall back or show blank.

**Approach:**
- Consume the new `actorName` field from the dashboard activity payload (no client-side guessing).
- Add empty/loading states for the recent-activity and upcoming-deadlines sections (currently silent when empty).
- i18n keys for empty states in both files.

**Acceptance criteria:**
- Dashboard recent activity shows actor display names.
- Empty activity / no deadlines render a friendly empty state, not blank.
- `npm run build` green.

---

## 🤖 Agent D — Frontend Tests + CI Safety

### D26.1 — Vitest + frontend test setup (first-ever FE tests)
**Files:** `frontend/package.json`, new `frontend/vitest.config.ts` (or extend `vite.config.ts`), `frontend/src/**/*.test.ts(x)`, `frontend/tsconfig.json` (add test glob if needed)

**Problem:** Zero frontend tests (0 test files across 114 FE files). Backend has 44 test files.

**Approach:**
- Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDependencies.
- `vitest.config.ts` with `jsdom` environment + setup file (`@testing-library/jest-dom`).
- **Priority test targets** (pure-logic + critical UI): notification formatting/utils, i18n key parity helper, `useNotifications` hook logic, a smoke render of `NotificationItem`/`TaskCard`, and the dashboard empty-state component.
- Add `"test": "vitest run"` + `"test:watch"` scripts.

**Acceptance criteria:**
- `npm run test` green (at least ~10 meaningful tests across utils + components).
- `npm run build` still green.
- Wire into CI as a **required** job (see D26.2).

### D26.2 — CI safety rails (auto-merge + required checks + integration tests)
**Files:** `.github/workflows/auto-merge.yml`, `.github/workflows/ci.yml`, `tests/DevFlow.IntegrationTests/DevFlowWebApplicationFactory.cs`

**Problems:**
- **Auto-merge danger:** `auto-merge.yml` runs on `pull_request_target` and enables auto-merge **on PR open** — it merges whenever checks pass, with **no required-review gate**. Any agent's PR merges with zero human review. G13 in infra survey.
- **Integration tests silently pass:** `DevFlowWebApplicationFactory` falls back to InMemory DB when Docker unavailable, so CI "green" doesn't mean the real Postgres path was tested.

**Approach:**
- **Auto-merge safety:** Require approval before auto-merge. Options: (a) GitHub branch-protection "Require review" + make auto-merge respect it (cleanest, but repo settings not in-repo); (b) change workflow to only enable auto-merge after a review is approved via `pull_request_review` trigger + check the review state; (c) gate on a `needs` that verifies all CI jobs passed AND an approving review exists. Recommend (b)+(c): trigger on `pull_request_review` with `action: submitted, state: approved`, and keep `pull_request_target` trigger but only merge when a review is present. **Requires repo settings too** — document the branch-protection requirement.
- **Integration tests in CI:** run a Postgres service container in the CI job so `DevFlowWebApplicationFactory` uses real Postgres instead of the silent InMemory fallback. Verify the factory's Docker-detection logic and make the CI service container satisfy it (env var override is cleaner — add `USE_INMEMORY`/`UsePostgres` config flag).
- Optionally add ESLint to `ci.yml` frontend job (or fold into D26.1 as `npm run lint`).

**Acceptance criteria:**
- A PR does NOT auto-merge without an approving review (verify by code review of workflow + documented branch-protection requirement).
- CI integration job runs against real Postgres (service container), not the silent fallback; a failing integration test now fails CI.
- Documented in `README.md` or `.github/` (branch-protection checklist).

---

## 🧭 Deferred to Sprint 27+ (design needed)

- **Global search rewrite** (ILike / tsvector / index + pagination) — needs an EF/SQL design decision, not just code.
- **DB backup/restore automation** — ops task (pg_dump cron + runbook), no code changes in `src/`.
- **Project-level member management** — product decision on model.

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys.
- Shared files: `api.ts`, `package.json`, `Program.cs`, `AppShell.tsx` — single-agent lock.
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 26)

- [ ] A26.1 Dashboard single-query + actor names
- [ ] A26.2 Outbox DLQ / retry cap
- [ ] A26.3 Sprint DELETE endpoint
- [ ] B26.1 Unified notification preferences
- [ ] B26.2 Soft-delete + archive-restore
- [ ] C26.1 Task watcher UI
- [ ] C26.2 Dashboard actor names + empty states
- [ ] D26.1 Vitest + first FE tests
- [ ] D26.2 CI safety (auto-merge review gate + real-Postgres integration)
- [ ] All PRs reviewed & merged; AGENT_STATUS.md updated to Sprint 26 Complete

---
*DevFlow Architecture Team — Sprint 26 plan (2026-08-24)*
