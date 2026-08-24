# 🚀 Sprint 27 — Search & Event Coverage (Live Team Experience)

**Status:** Ready for Agents A/B/C/D
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint27-<feature>` (Agent A, B) / `feat/frontend-sprint27-<feature>` (Agent C, D)
**Updated:** 2026-08-24

---

## Why This Sprint

Sprint 26 merged on main (PRs #117–119 + B26 follow-ups): dashboard single-query + actor names, outbox DLQ/retry cap, sprint DELETE, unified notification-preferences engine with in-app mute, soft-delete + archive/restore, task-watcher UI, Vitest + CI safety rails. A fresh read-only survey of `origin/main` found the **next real gaps** — all items explicitly deferred from Sprint 26 plus new event-coverage holes:

1. **Global search is still in-memory LINQ + N+1 with no pagination** (`SearchQueryHandler.cs` loops every project calling `GetForProjectAsync`, then loops tasks calling `GetForTaskAsync` per comment). The most-used workspace page degrades as data grows. *(Deferred from S26 #2, P0.)*
2. **Email only covers 3 event types** — `StatusChanged`, `CommentAdded`, `RoleChanged`, `RemovedFromWorkspace` have no email template AND no notification toggle. Users can't opt into/out of the events that matter.
3. **Archive/restore has no frontend UI** — backend `POST .../projects/{id}/restore` exists (B26.2) but archived projects are invisible in the UI; users can't restore them.
4. **8 feature folders have zero unit tests** (`BulkOperations`, `Email`, `Export`, `GitHub`, `Import`, `Labels`, `Templates`, `Users`) — including security-relevant GitHub webhook HMAC logic.
5. **DB backup automation** still missing *(Deferred from S26 #3, ops/script.)*
6. **Integration tests**: only one file (`AuthAndWorkspaceIntegrationTests.cs`) exercises the real Postgres path.

Verified done on main (NOT in scope): dashboard aggregation (A26.1), outbox DLQ (A26.2), sprint delete (A26.3), notif-prefs engine + in-app mute (B26.1), soft-delete + restore endpoint (B26.2), watcher UI (C26.1), Vitest + CI rails (D26.1/2), **GitHub webhook HMAC verification** (`GitHubWebhookController` computes `sha256=` signature).

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead — me)** | Backend search rewrite | `feat/backend-sprint27-*` | A27.1 Global search DB-level + pagination, A27.2 Review/merge B/C/D |
| **B (Backend)** | Email coverage + test gaps | `feat/backend-sprint27-*` | B27.1 Email templates + toggles for 4 missing events, B27.2 Unit tests for untested features |
| **C (Frontend)** | Search UI + archive/restore UX | `feat/frontend-sprint27-*` | C27.1 Paginated search UI, C27.2 Archived-project list + Restore UI |
| **D (Frontend + Infra)** | Prefs UI + DB backup | `feat/frontend-sprint27-*` | D27.1 Notification-preferences settings for new toggles, D27.2 DB backup automation |

> **Rule:** each agent stays in its own scope. Shared files (`api.ts`, `types/api.ts`, `package.json`, `i18n/*.json`, `AppShell.tsx`, `SettingsPage.tsx`) require a single-agent lock. **C and D must NOT both edit `SettingsPage.tsx`** — C owns archive/restore, D owns prefs toggles; keep their file sets disjoint.

---

## 🔬 Priority-Ordered Gaps (source: read-only survey, verified on `main` @ c55f625)

| # | Gap | Severity | Status |
|---|---|---|---|
| 1 | Global search in-memory LINQ + N+1 + no pagination (`SearchQueryHandler.cs`) | P0 | **A27.1** |
| 2 | Email covers only TaskAssigned/Mention/SprintStarted; 4 event types have no template + no toggle | P1 | **B27.1** |
| 3 | No archived-project list / Restore UI (backend endpoint exists) | P1 (UX) | **C27.2** |
| 4 | 8 feature folders with zero unit tests (Email, GitHub, Labels, Templates, Import/Export, Bulk, Users) | P2 | **B27.2** |
| 5 | No DB backup/restore automation | P2 (ops) | **D27.2** |
| 6 | Integration tests: only 1 file on real Postgres | P2 | Rolled into B27.2 |
| 7 | Project-level member management | P2 | Deferred (product decision) |
| 8 | Dashboard/outbox/sprint-delete/notif-prefs/watcher/soft-delete — all done S26 | — | ✅ DONE |

---

## 🤖 Agent A — Global Search Rewrite (Team Lead)

### A27.1 — DB-level search + pagination, kill the N+1
**Files:** `src/DevFlow.Application/Features/Search/SearchQueryHandler.cs`, `SearchQuery.cs` (result records), `src/DevFlow.Api/Controllers/SearchController.cs`, `src/DevFlow.Application/Common/Interfaces/ITaskItemRepository.cs` (+ other repos as needed)

**Problem:** `SearchQueryHandler` fetches **all** projects then loops each calling `GetForProjectAsync` (N+1); comments loop fetches `GetForTaskAsync` per task (N+2). Keyword matching is in-memory `.Contains`. No pagination — every result set is hard-capped (`Take(10)` etc.) with no total/offset.

**Approach (design decision made):**
- Do the filtering **in SQL** via `EF.Functions.ILike($"{keyword}%")` / `EF.Functions.ILike($"%{keyword}%")` on PostgreSQL (case-insensitive substring, index-friendly), replacing in-memory `.Contains` on `Name`/`Key`/`Title`/`Description`/`Content`/`DisplayName`/`Username`.
- Add **one** `ISearchRepository.SearchAsync(...)` (or batch methods on existing repos) that runs a single query per entity type over the workspace's project IDs — no per-project loops.
- Add pagination metadata to `SearchResult`: per-group `Total`, `Page`, `PageSize` (keep existing `Take` defaults as `PageSize`), returned alongside the capped item lists.
- Keep existing filters (`Status`, `Priority`, `AssigneeId`, `LabelId`, `DueBefore`, `DueAfter`) and empty-keyword fast-path.
- Update `SearchController` to accept `page`/`pageSize`; extend `SearchQuery` records with `Total`/`Page`.

**Acceptance criteria:**
- Search runs ≤6 DB queries (one per entity type), no per-project/per-task loops.
- Keyword matching is case-insensitive and done by PostgreSQL, not in-memory LINQ.
- `SearchResponse` carries pagination metadata; `/search?page=2` returns the next page.
- All existing `SearchQueryHandlerTests` updated + new tests for pagination + ILike predicate.
- `dotnet build` + `dotnet test` green.

### A27.2 — Review & merge B/C/D PRs
- Review each PR against its AC, run `dotnet test` / `npm run build` + i18n parity, merge when green, update `AGENT_STATUS.md`.

---

## 🤖 Agent B — Email Event Coverage + Test Gaps

### B27.1 — Email templates + toggles for missing event types
**Files:** `src/DevFlow.Application/Features/Email/EmailService.cs` (interface + `NoOpEmailService`), `src/DevFlow.Infrastructure/Email/ResendEmailService.cs`, `src/DevFlow.Domain/Entities/NotificationPreferences.cs`, `src/DevFlow.Application/Common/Behaviors/NotificationBehavior.cs`, notification-feature commands that raise the events, EF migration.

**Problem:** `IEmailService` has only `SendTaskAssigned`/`SendMention`/`SendSprintStarted`. `StatusChanged`, `CommentAdded`, `RoleChanged`, `RemovedFromWorkspace` create in-app notifications but send **no email** and have **no preference toggle**.

**Approach:**
- Add 4 methods to `IEmailService` + `NoOpEmailService` + `ResendEmailService` (Resend-compatible HTML bodies, mirror existing 3 templates).
- Extend `NotificationPreferences` with matching email+in-app toggles for the 4 new event types (e.g. `EmailOnStatusChanged`, `InAppOnStatusChanged`, …) — default `true`, + migration.
- Wire each new event path: gate email + in-app creation on the corresponding toggle inside `NotificationBehavior`/the raising handler (mirror the `IsInAppAllowed` pattern at `NotificationBehavior.cs:88`).
- Extend `NotificationPreferencesController` GET/PUT DTOs with the new fields.

**Acceptance criteria:**
- Each of the 4 event types can be muted (email + in-app) independently via prefs.
- Emails for the 4 events send through the existing Resend path when enabled.
- New preference fields round-trip via `GET/PUT /users/me/notification-preferences`.
- Unit tests: pref gating per new event type; migration applied.
- `dotnet build` + `dotnet test` green.

### B27.2 — Unit tests for untested features
**Files:** new folders under `tests/DevFlow.UnitTests/Features/` — `GitHub/`, `Labels/`, `Templates/`, `Email/`, `Import/`, `Export/` (pick highest-value first).

**Problem:** 8 feature folders have zero unit tests. Highest-value: GitHub webhook HMAC verification + `TaskKeyParser`, Labels CRUD, Template CRUD, email service contract.

**Approach:** NSubstitute-based handler tests mirroring `tests/DevFlow.UnitTests/Features/Sprints/DeleteSprintCommandHandlerTests.cs`. Where an integration-test gap is cheaper to close, prefer extending `tests/DevFlow.IntegrationTests/AuthAndWorkspaceIntegrationTests.cs` (real Postgres path).

**Acceptance criteria:**
- ≥10 new tests across GitHub webhook (HMAC + event routing), Labels, Templates, and Email service.
- `dotnet test` green; no flaky/order-dependent tests.

---

## 🤖 Agent C — Search UI + Archive/Restore UX

### C27.1 — Paginated search UI
**Files:** `frontend/src/pages/SearchPage.tsx`, `frontend/src/components/CommandPalette.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, `frontend/src/i18n/en.json` + `vi.json`.

**Approach:** consume the new pagination metadata from A27.1 — add "load more"/page controls per tab, show result counts ("N results"), keep tab layout. i18n keys in **both** files (parity test enforces this).

**Acceptance criteria:** search tabs page correctly; result totals shown; `npm run build` green; i18n parity test green.

### C27.2 — Archived-project list + Restore UI
**Files:** `frontend/src/pages/WorkspacePage.tsx`, `frontend/src/components/projects/*`, `frontend/src/lib/api.ts` (`restoreProject`), `frontend/src/types/api.ts`, i18n files.

**Problem:** backend `POST .../projects/{id}/restore` exists (B26.2) but the UI has zero "restore" code; archived projects are listed (ListProjects returns all statuses) but have no restore affordance.

**Approach:** show archived projects with a "Restore" button (Admin-gated, matching archive affordance), call `restoreProject`, refresh list. Empty-state text for "no archived projects" in both i18n files.

**Acceptance criteria:** archived project card shows status + Restore action; restore returns it to Active in the list; `npm run build` green.

---

## 🤖 Agent D — Prefs Settings UI + DB Backup Automation

### D27.1 — Notification-preferences settings for the new toggles
**Files:** `frontend/src/pages/SettingsPage.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n files. **Only D edits `SettingsPage.tsx`.**

**Approach:** render the 4 new event-type toggle groups (StatusChanged, CommentAdded, RoleChanged, RemovedFromWorkspace — email + in-app) added in B27.1, mirroring the existing prefs section at `SettingsPage.tsx:206`. Persist via the existing GET/PUT endpoint.

**Acceptance criteria:** all 8 toggles render + persist; `npm run build` green; i18n parity green.

### D27.2 — DB backup automation
**Files:** `scripts/backup-db.sh` (new), `.github/workflows/backup.yml` (new, scheduled `pg_dump` via service container → artifact), `docs/sprint27/runbook-backup.md` (new), optional `README.md` note.

**Approach:** a script that dumps the Postgres DB to a timestamped archive; a scheduled GitHub Action (daily, e.g. `cron: 17 3 * * *`) that runs `pg_dump` and uploads a backup artifact; runbook documenting restore (`psql`/`pg_restore` steps).

**Acceptance criteria:** script runs on a local Postgres; workflow file passes YAML lint; runbook documents restore. No `src/` changes.

---

## 🧭 Deferred to Sprint 28+ (needs decision)

- **Project-level member management** — product decision on the model (workspace-level members already exist; project-level needs a design call).
- **Search relevance ranking / typo tolerance / tsvector** — beyond ILIKE; revisit if search UX demands it.
- **Webhook retry/outbox admin UI** (DLQ inspection/manual redelivery) — backend infra done, UI pending.

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys (add to BOTH `en.json` and `vi.json`).
- Shared files single-agent lock: `api.ts`, `types/api.ts`, `package.json`, `i18n/*.json`, `AppShell.tsx`, `SettingsPage.tsx` (D only).
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 27)

- [ ] A27.1 Global search DB-level + pagination
- [ ] A27.2 Review & merge B/C/D PRs; AGENT_STATUS.md → Sprint 27 Complete
- [ ] B27.1 Email templates + toggles for 4 missing events
- [ ] B27.2 Unit tests for untested features
- [ ] C27.1 Paginated search UI
- [ ] C27.2 Archived-project list + Restore UI
- [ ] D27.1 Notification-preferences settings UI
- [ ] D27.2 DB backup automation

---

## After Approval (execution)

1. Write `docs/sprint27/plan.md` (this content) + `docs/sprint27/prompts/prompt-{B,C,D}.md` (each: context, tasks, AC, branch convention, files, quality gates).
2. Update `AGENT_STATUS.md` (Sprint 26 → Complete; Sprint 27 row with A/B/C/D).
3. Commit + push plan, open PR (Agent A planning/review only; B/C/D code by those agents).
4. Begin A27.1 (search rewrite) on `feat/backend-sprint27-search`, then review B/C/D PRs as they land.

## Verification

- Plan + prompts render; each agent can start without re-deriving context.
- AGENT_STATUS.md reflects true merged state.
- Backend (A27.1/B27): `dotnet build` + `dotnet test` green; new handler tests.
- Frontend (C27/D27): `npm run build` green; i18n parity test green.

---
*DevFlow Architecture Team — Sprint 27 plan (2026-08-24)*
