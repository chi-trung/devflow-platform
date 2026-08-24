# 🚀 Sprint 28 — Webhook Reliability & Project Management UX

**Status:** Planning
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint28-<feature>` (A/B) / `feat/frontend-sprint28-<feature>` (C/D)
**Updated:** 2026-08-24

---

## Why This Sprint

Sprint 27 merged (PRs #120–123): DB-level search + pagination, email coverage for 4 events + 26 tests, search UI + restore-project UI, prefs UI + DB backup. A read-only survey of `origin/main` found the **highest-impact remaining gaps**:

1. **Webhook delivery failures are silently swallowed** — `WebhookDispatcher.cs` wraps `PostAsync` in `catch {}` that eats all errors, so the outbox DLQ (retry 10× then dead-letter) is never populated. Integrations silently break without alerting anyone. *(P0 — data-loss risk.)*
2. **No project settings/edit UI** — users can create/archive/delete projects but cannot edit name/key/description. No project-level member management.
3. **Search filter parity** — backend supports `assigneeId`, `labelId`, `dueBefore`, `dueAfter` filters but `SearchPage.tsx` only surfaces `status` + `priority`. No sort controls.
4. **4 feature folders with zero unit tests** — `BulkOperations`, `Export`, `Import`, `Users` — exactly where data-corruption bugs hide.
5. **No reusable `Dialog`/`Modal` or `EmptyState` components** — 4+ hand-rolled modals, repeated empty-state markup.
6. **Workspace-level analytics gap** — `getTeamReport` hits `/workspaces/{wsId}/reporting/team` but Dashboard has no workspace-level analytics tiles; ReportsPage is project-scoped only.
7. **Reporting trends placeholder** — `GetTeamReportHandler` returns `TeamReportTrends(0, null)` ("placeholder - compare with previous sprint").
8. **Notification center lacks "mention" filter** + deep-link to notification settings.
9. **vi.json localization gaps** — `savedSearch` and `commandPalette` sections are English placeholders.

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead)** | Backend — webhook DLQ + IOutboxRepository | `feat/backend-sprint28-*` | A28.1 Webhook DLQ fix + admin retry endpoint, A28.2 Review/merge B/C/D |
| **B (Backend)** | Tests + reporting/search polish | `feat/backend-sprint28-*` | B28.1 Unit tests for 4 untested folders, B28.2 Reporting trends + search sort/custom-field |
| **C (Frontend)** | Project settings + search UX + components | `feat/frontend-sprint28-*` | C28.1 Project settings UI + Dialog/Modal + EmptyState, C28.2 Search filter parity + sort |
| **D (Frontend + Infra)** | Analytics + notification center + i18n | `feat/frontend-sprint28-*` | D28.1 Workspace-level analytics dashboard tiles, D28.2 Notification mention filter + settings link + vi.json fill-in |

---

## 🤖 Agent A — Webhook DLQ Fix + Admin Endpoint (Team Lead)

### A28.1 — Webhook delivery failures → DLQ, admin retry UI
**Files:** `src/DevFlow.Infrastructure/WebhookDispatcher.cs`, `src/DevFlow.Application/Common/Interfaces/IOutboxRepository.cs`, `src/DevFlow.Infrastructure/Persistence/Repositories/OutboxRepository.cs`, `src/DevFlow.Api/Controllers/WebhooksController.cs` (or new `WebhooksAdminController.cs`), `src/DevFlow.Application/Common/Interfaces/IWebhookRepository.cs` (maybe, for DLQ query)

**Problem:** `WebhookDispatcher.DispatchAsync` wraps `client.PostAsync` in `try/catch {}` that swallows all errors. The outbox processor (`OutboxProcessor.ProcessMessageAsync`) calls `webhookDispatcher.DispatchAsync` inside a `try/catch` that re-throws, but the inner `catch {}` prevents the exception from ever reaching the outer retry/DLQ logic. Result: webhook messages are always `MarkProcessed` even on failure.

**Approach:**
- Remove the `catch {}` in `WebhookDispatcher.DispatchAsync` — let `HttpRequestException` propagate up to `OutboxProcessor.ProcessMessageAsync` which already has retry + DLQ logic.
- Add `GetFailedAsync(int batchSize)` + `GetDeadLetteredAsync(int batchSize)` + `ResetRetryAsync(Guid id)` + `ReplayAsync(Guid id)` to `IOutboxRepository` / `OutboxRepository`.
- Add admin endpoint `GET /api/v1/admin/outbox/dead-letter` (list) + `POST /api/v1/admin/outbox/{id}/replay` (retry) to a new `AdminController.cs` (Authorize, Admin-only).
- Keep `WebhooksController` test-fire endpoint as-is; add DLQ list/retry there or in admin namespace.

**Acceptance criteria:**
- Webhook HTTP failures propagate → OutboxProcessor retries (up to 10×) → dead-letters.
- DLQ list endpoint returns failed messages with error + retry count + timestamp.
- Replay endpoint resets `RetryCount` + clears `FailedPermanentlyAt` so the next processor cycle picks it up.
- All existing webhook tests pass; new tests for DLQ query + replay.
- `dotnet build` + `dotnet test` green.

### A28.2 — Review & merge B/C/D PRs
- Review each PR, run `dotnet test` / `npm run build` + i18n parity, merge when green, update `AGENT_STATUS.md`.

---

## 🤖 Agent B — Test Coverage + Reporting/Search Polish

### B28.1 — Unit tests for 4 untested feature folders
**Files (new):** `tests/DevFlow.UnitTests/Features/BulkOperations/`, `tests/DevFlow.UnitTests/Features/Export/`, `tests/DevFlow.UnitTests/Features/Import/`, `tests/DevFlow.UnitTests/Features/Users/`

**Approach:** NSubstitute-based handler tests mirroring existing patterns (`tests/DevFlow.UnitTests/Features/Sprints/DeleteSprintCommandHandlerTests.cs`). Each handler in `src/DevFlow.Application/Features/{BulkOperations,Export,Import,Users}/` gets at minimum:
- Happy path (success case)
- Validation failure (empty input, invalid params)
- Authorization / workspace-scoping (where applicable)

**Target:** ≥8 new tests total (≥2 per folder).

**Acceptance criteria:**
- `BulkOperations`, `Export`, `Import`, `Users` each have at least a test file.
- `dotnet test` green; no flaky/order-dependent tests.

### B28.2 — Reporting trends + search sort + custom-field search
**Files:** `src/DevFlow.Application/Features/Reporting/ReportingHandlers.cs` (or `GetTeamReportHandler.cs`), `src/DevFlow.Application/Features/Search/SearchQuery.cs`, `SearchQueryHandler.cs`, `src/DevFlow.Infrastructure/Persistence/Repositories/SearchRepository.cs`

**Approach:**
- **Reporting trends:** Replace `TeamReportTrends(0, null)` with real data: compare current sprint vs previous sprint for `tasksCompleted`, `totalMinutes`, `avgCycleTimeDays`. Reuse existing `GetTeamReportHandler`'s query logic for the previous sprint (same date-range logic, just shift start/end by sprint duration).
- **Search sort:** Add `SortBy` (string: `"createdAt"`, `"updatedAt"`, `"title"`, `"status"`, `"priority"`, `"dueDate"`) + `SortDir` (`"asc"` / `"desc"`) to `SearchQuery` and `SearchQueryHandler`. Pass through to `SearchRepository` as `OrderBy`/`OrderByDescending` on the base query.
- **Custom-field search:** Add `SearchCustomFieldsAsync` to `ISearchRepository` (ILike on `CustomFieldValue.Value` joined to task). Wire into `SearchQueryHandler` as a 6th parallel query.

**Acceptance criteria:**
- `TeamReportTrends` returns real numbers (not 0/null) when a previous sprint exists.
- Search accepts `sortBy`/`sortDir` params; results ordered accordingly.
- Custom field values are searchable via ILIKE.
- `dotnet build` + `dotnet test` green.

---

## 🎨 Agent C — Project Settings UI + Search UX + Component Library

### C28.1 — Project settings/edit UI + reusable Dialog/Modal + EmptyState
**Files:** `frontend/src/pages/WorkspacePage.tsx` (edit mode for project name/key/description), `frontend/src/components/ui/Dialog.tsx` (new), `frontend/src/components/ui/EmptyState.tsx` (new), `frontend/src/lib/api.ts` (`updateProject`), `frontend/src/types/api.ts`, i18n files.

**Approach:**
- **Dialog/Modal:** Create a reusable `Dialog` component in `frontend/src/components/ui/` wrapping a portal + overlay + close-on-escape + focus-trap pattern. Port existing hand-rolled modals (CommandPalette, TaskDetailPanel, NotificationsPanel) to use it — at minimum, migrate the ConfirmDialog and one other.
- **EmptyState:** Create a reusable `EmptyState` component (icon, title, description, optional CTA button). Replace the copy-pasted dashed-border empty states across SearchPage, DashboardPage, WorkspacePage, SavedSearchesPage, NotificationsPage.
- **Project settings:** Add "Edit" button to project cards in `WorkspacePage` (Admin/Owner-gated). Opens a Dialog with name/key/description fields. The backend `UpdateProject` handler already exists (`src/DevFlow.Application/Features/Projects/Update/UpdateProjectCommandHandler.cs`). Add `updateProject` to `api.ts` if missing (check `PUT /workspaces/{wsId}/projects/{projectId}`). i18n keys for edit dialog.

**Acceptance criteria:**
- `Dialog` component renders overlay + content + closes on Escape/outside-click.
- `EmptyState` component replaces dashed-border patterns in ≥3 pages.
- Project edit dialog saves name/key/description via API; list refreshes.
- `npm run build` green; i18n parity green.

### C28.2 — Search filter parity + sort controls
**Files:** `frontend/src/pages/SearchPage.tsx`, `frontend/src/components/CommandPalette.tsx`, `frontend/src/lib/api.ts` (`SearchFilters`), `frontend/src/types/api.ts`, i18n.

**Approach:**
- Surface `assigneeId`, `labelId`, `dueBefore`, `dueAfter` filters in `SearchPage.tsx` — add dropdown/date-picker controls alongside the existing status+priority filters.
- Add sort control (sortBy dropdown + sortDir toggle) to SearchPage, consuming the new backend params from B28.2.
- Add "Apply saved search" dropdown on SearchPage (load from `getSavedSearches`, fill filters, run search).
- Wire all new params through `searchWorkspace` in `api.ts`.
- i18n keys for new filter labels in both files.

**Acceptance criteria:**
- All backend-supported filters (assignee/label/due date) are surfaced in the UI.
- Sort controls change result ordering.
- Saved searches can be applied from the search page.
- `npm run build` green; i18n parity green.

---

## 🚀 Agent D — Analytics Dashboard + Notification Center + i18n

### D28.1 — Workspace-level analytics dashboard tiles
**Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/dashboard/TeamPerformancePanel.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n.

**Approach:**
- The backend `getTeamReport` (`GET /workspaces/{wsId}/reporting/team`) already returns workspace-level aggregates. The Dashboard already has `TeamPerformancePanel` component. **Verify** — if it's already wired, add missing tiles: velocity trend, cycle/lead time averages, per-member task load. If not wired, wire it.
- Add a "View reports" link from Dashboard to the project-level ReportsPage.
- Add a "Sprint health" card showing current sprint burndown + velocity trend using existing `getBurndown`/`getVelocity` data.
- All new tiles use existing `Skeleton` loading state + `ErrorAlert` error state patterns.

**Acceptance criteria:**
- Dashboard shows workspace-level team performance metrics from the existing API.
- Sprint health card renders burndown + velocity when a sprint is active; empty state when none.
- `npm run build` green; i18n parity green.

### D28.2 — Notification mention filter + settings link + vi.json fill-in
**Files:** `frontend/src/components/notifications/NotificationsPanel.tsx`, `frontend/src/pages/NotificationsPage.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/i18n/en.json` (if needed), `frontend/src/pages/SettingsPage.tsx` (add hash link target).

**Approach:**
- **Mention filter:** Add "Mentions" tab to NotificationsPanel + NotificationsPage alongside existing All/Unread/Read. Reuse the existing `notificationType` filter pattern (backend `GET /notifications` supports `?type=mention` via `NotificationRepository.GetUserNotificationsAsync` — check the exact param).
- **Settings deep-link:** Add a "Notification settings" link (gear icon) in NotificationsPanel header + NotificationsPage, linking to `/settings#notifications`. Add `id="notifications"` anchor on the prefs section in `SettingsPage.tsx`.
- **vi.json fill-in:** Translate the `savedSearch` and `commandPalette` sections (currently English placeholders). Do NOT add/remove keys — only translate values. The i18n parity test enforces key matching.

**Acceptance criteria:**
- "Mentions" tab filters to mention-type notifications.
- Notification settings link navigates to `/settings` and scrolls to prefs section.
- `vi.json` `savedSearch` + `commandPalette` sections are in Vietnamese.
- `npm run build` green; i18n parity test green.

---

## 🧭 Deferred to Sprint 29+

- **Project-level member management / RBAC** — needs a product decision on the data model; full design sprint.
- **Webhook/outbox admin UI** — backend DLQ endpoint done in A28.1; full admin page (DLQ inspection, manual replay, retry-all) deferred.
- **Search relevance ranking / tsvector** — beyond ILIKE; revisit if search UX demands it.
- **Integration test expansion** — single file still; needs a dedicated test-infra sprint.

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys (add to BOTH `en.json` and `vi.json`).
- Shared files single-agent lock: `api.ts`, `types/api.ts`, `i18n/*.json`, `AppShell.tsx`, `SettingsPage.tsx` (D only for SettingsPage anchor; C does NOT touch SettingsPage).
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 28)

- [ ] A28.1 Webhook DLQ fix + admin retry endpoint
- [ ] A28.2 Review & merge B/C/D PRs; AGENT_STATUS.md → Sprint 28 Complete
- [ ] B28.1 Unit tests for BulkOperations, Export, Import, Users
- [ ] B28.2 Reporting trends real implementation + search sort/custom-field
- [ ] C28.1 Project settings UI + reusable Dialog/Modal + EmptyState
- [ ] C28.2 Search filter parity + sort controls
- [ ] D28.1 Workspace-level analytics dashboard tiles
- [ ] D28.2 Notification mention filter + settings link + vi.json fill-in

---

## After Approval (execution)

1. Write `docs/sprint28/plan.md` + `docs/sprint28/prompts/prompt-{B,C,D}.md`.
2. Update `AGENT_STATUS.md` (Sprint 27 → Complete; Sprint 28 row with A/B/C/D).
3. Commit + push plan to main, open PR (Agent A planning/review only).
4. Begin A28.1 (webhook DLQ) on `feat/backend-sprint28-webhook-dlq`, then review B/C/D PRs as they land.