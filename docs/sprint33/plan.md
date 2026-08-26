# 🚀 Sprint 33 — Compounding Knowledge Base (Wiki / ADR / Runbook + Auto-Capture)

**Status:** Complete ✅
**Branch base:** `origin/main` (main locked by worktree `devflow-sprint31-be`)
**Branch:** `feat/landing-parity-sprint-c`
**Plan source:** `wise-prancing-ritchie.md` (landing ↔ app feature-gap plan, "PR 3 — Sprint C")
**Updated:** 2026-08-26

---

## Why This Sprint

The landing page advertises *"Compounding wiki — ADRs, patterns & runbooks captured automatically as work ships"*, *"Drift warnings"* and the *"Iron Law: anything shipped is documented"*. Verified against the app: there was **zero** knowledge-base code in `src/` — no `KnowledgeEntry` entity, no ADR/runbook endpoints, and nothing that records a decision when a task ships. Sprint C delivers the real feature:

1. **KnowledgeEntry entity** (ADR / Pattern / Runbook) with a full lifecycle — Draft → Proposed → Accepted → Superseded / Deprecated — plus a 0..1 **weight** field so higher-confidence entries outrank speculative ones (feeds the AI planner in Sprint E).
2. **Full CRUD + supersede API** under `/api/v1/workspaces/{ws}/projects/{proj}/knowledge`.
3. **Auto-capture hook (the honest "Iron Law")**: when a task moves to **Done**, the update handler creates a **Draft Runbook** from the task title/description with a link to the task — same transaction as the activity log, unit-tested.
4. **Frontend Knowledge page**: entry cards with status/type badges + weight chips, create/edit dialog, supersede flow, auto-captured indicator, and nav wiring.

## 🎯 Work Assignment (single agent — Team Lead)

| Task | Scope | Status |
|---|---|---|
| **C1** | `KnowledgeEntry` entity + config + migration + repository + DI | ✅ Complete |
| **C1b** | Knowledge CQRS (Create/List/Update/Delete/Supersede) + `KnowledgeController` + `KnowledgeRequests` + **auto-capture hook** in `UpdateTaskItemCommandHandler` + unit tests | ✅ Complete |
| **C2** | Frontend — `KnowledgePage` + `KnowledgeEntryCard` + create/edit dialog + supersede UI + i18n keys (en+vi) + nav wiring | ✅ Complete |
| **C3** | Docs + AGENT_STATUS + commit + PR + merge | ✅ Complete |

## 📦 Backend (C1 + C1b)

- `src/DevFlow.Domain/Enums/KnowledgeEnums.cs` — `KnowledgeType` (`Adr/Pattern/Runbook`), `KnowledgeStatus` (`Draft/Proposed/Accepted/Superseded/Deprecated`).
- `src/DevFlow.Domain/Entities/KnowledgeEntry.cs` — factory `Create` / `CaptureFromTask` (Draft), `UpdateDetails`, `UpdateStatus`, `MarkSupersededBy` (sets `SupersededById` + weight 0.05), `Deprecate`, `SetWeight` (clamped 0..1).
- `src/DevFlow.Infrastructure/Persistence/Configurations/KnowledgeEntryConfiguration.cs` — `knowledge_entries` table, enum→`HasConversion<string>()`, `Weight` `HasPrecision(3,2)`, FK Project cascade / TaskItem SetNull / self-FK `SupersededById` SetNull, indexes `(ProjectId, Status)`, `(ProjectId, Type)`, `TaskId`.
- Migration `20260826060339_AddKnowledgeEntries.cs`.
- `IKnowledgeRepository` + `KnowledgeRepository` (orders `Weight desc, CreatedAtUtc desc`); `DbSet<KnowledgeEntry>` + DI registration.
- `Features/Knowledge/{Create,List,Update,Delete,Supersede}` — CQRS handlers following the Milestone pattern, `[RequireWorkspaceRole(Member)]`, `IProjectEvent` for activity auto-logging.
- `src/DevFlow.Api/Controllers/KnowledgeController.cs` — `GET/POST/PUT/DELETE .../knowledge`, `POST .../knowledge/{id}/supersede`; `Contracts/Knowledge/KnowledgeRequests.cs`.
- **Auto-capture hook** — `UpdateTaskItemCommandHandler`: injects `IKnowledgeRepository`; inside the existing `if (task.Status != oldStatus)` block, when `task.Status == Done` → `KnowledgeEntry.CaptureFromTask(projectId, task.Id, task.Title, task.Description, KnowledgeType.Runbook, tags: "auto-captured")`.
- Tests: `KnowledgeHandlerTests.cs` (8 tests) + auto-capture assertions in `TaskItemHandlerTests`.

## 🎨 Frontend (C2)

- `frontend/src/types/api.ts` — `KnowledgeType`/`KnowledgeStatus`/`KnowledgeEntryResponse`/`CreateKnowledgeEntryRequest`/`UpdateKnowledgeEntryRequest`/`KnowledgeEntryCreatedResponse`.
- `frontend/src/lib/api.ts` — `getKnowledgeEntries`/`createKnowledgeEntry`/`updateKnowledgeEntry`/`deleteKnowledgeEntry`/`supersedeKnowledgeEntry`.
- `frontend/src/components/knowledge/KnowledgeEntryCard.tsx` — type icon + status badge + weight chip + tags + auto-captured/superseded indicators + edit/delete/supersede actions.
- `frontend/src/pages/KnowledgePage.tsx` — active/retired entry groups, create/edit `Dialog`, supersede dialog, `ConfirmDialog` delete, `EmptyState`.
- `frontend/src/App.tsx` — lazy route `/workspaces/:ws/projects/:proj/knowledge`; `BoardPage` nav item (`BookOpen` icon).
- i18n — `knowledge.*` + `nav.knowledge` in **both** `en.json` + `vi.json` (parity test green).

## ✅ Verification

- `dotnet build DevFlow.sln` — 0 warnings / 0 errors.
- `dotnet test` — **362/362 green** (360 unit + 2 integration).
- `npm run build` (tsc strict) — green.
- `npm test` — **30/30 green** (incl. i18n parity).

## 🔗 Merge

PR #187 — squash-merged via `gh pr merge --admin --squash`.
