# Prompt — Agent B (Backend): Test Coverage + Reporting/Search Polish

> You are **Agent B** on the DevFlow sprint team. Full plan: `docs/sprint28/plan.md`. Read it first.
> **Branch:** `feat/backend-sprint28-test-reporting` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** `dotnet build` + `dotnet test` 100% green before you open your PR.

---

## Context

DevFlow is a .NET 8 Clean Architecture project-manager (DevFlow.Domain → Application → Infrastructure → Api, CQSS+MediatR, EF Core + PostgreSQL). Sprint 27 merged. Two gaps for you:

1. **4 Application feature folders have zero unit tests** — `BulkOperations`, `Export`, `Import`, `Users` (`src/DevFlow.Application/Features/`). These are exactly where data-corruption bugs hide.
2. **Reporting trends are a placeholder** — `GetTeamReportHandler` returns `TeamReportTrends(0, null)` with a comment "placeholder - in real app, compare with previous sprint" (`src/DevFlow.Application/Features/Reporting/ReportingHandlers.cs:143-145`).
3. **Search lacks sort + custom-field search** — `SearchQuery` has no `sortBy`/`sortDir`; custom field values aren't searched.

---

## Task B28.1 — Unit tests for 4 untested feature folders

### Files (new test folders)
- `tests/DevFlow.UnitTests/Features/BulkOperations/`
- `tests/DevFlow.UnitTests/Features/Export/`
- `tests/DevFlow.UnitTests/Features/Import/`
- `tests/DevFlow.UnitTests/Features/Users/`

### Approach
Mirror the NSubstitute pattern in `tests/DevFlow.UnitTests/Features/Sprints/DeleteSprintCommandHandlerTests.cs` (`Substitute.For<IRepo>()`, `.Returns(...)`, `Arg.Any<>()`). The source handlers:
- `src/DevFlow.Application/Features/BulkOperations/BulkOperationsHandlers.cs`
- `src/DevFlow.Application/Features/Export/ExportHandlers.cs`
- `src/DevFlow.Application/Features/Import/ImportHandlers.cs`
- `src/DevFlow.Application/Features/Users/UserSearchHandlers.cs`

Each folder gets ≥2 tests covering: happy path, validation failure (empty input / bad params), and workspace/authorization scoping where the handler has it.

### Acceptance criteria
- ≥8 new tests total (≥2 per folder), all green.
- `dotnet test` passes with no flaky/order-dependent tests.

---

## Task B28.2 — Reporting trends + search sort + custom-field search

### Part A — Real team-report trends
**Files:** `src/DevFlow.Application/Features/Reporting/ReportingHandlers.cs`, `ReportingResponses.cs` (only if the record needs fields).

**Problem:** `TeamReportTrends(CompletedDelta, CycleTimeDelta)` is hardcoded `(0, null)`.

**Approach:** Compute `CompletedDelta` = this-period completed tasks − previous-period completed tasks, and `CycleTimeDelta` = this-period avg cycle time − previous-period avg cycle time. Reuse the existing per-member loop logic for the previous period (same queries, shifted date range). The `GetTeamReportQuery` already has a date range (check its fields — likely `StartDate`/`EndDate`); compute the previous window by subtracting the window length. If there's no previous data, return neutral `(0, null)` as today.

### Part B — Search sort
**Files:** `src/DevFlow.Application/Features/Search/SearchQuery.cs`, `SearchQueryHandler.cs`, `src/DevFlow.Infrastructure/Persistence/Repositories/SearchRepository.cs`, `src/DevFlow.Application/Common/Interfaces/ISearchRepository.cs`.

**Approach:**
- Add `SortBy` (`string?`, allowed: `createdAt`/`updatedAt`/`title`/`status`/`priority`/`dueDate`) + `SortDir` (`string?`, `asc`/`desc`, default `desc` for date sorts, `asc` for title) to `SearchQuery`.
- Pass through `SearchQueryHandler` → `SearchRepository.SearchTasksAsync` (add params or a sort record). In `SearchRepository`, replace the fixed `OrderByDescending(x => x.Task.CreatedAtUtc)` with a dynamic `OrderBy`/`OrderByDescending` switch on the allowed sort keys (protect against SQL injection — only map known keys).
- Update `SearchController` to accept `sortBy`/`sortDir` query params.

### Part C — Custom-field search
**Files:** `src/DevFlow.Application/Features/Search/SearchQuery.cs`, `SearchQueryHandler.cs`, `ISearchRepository.cs`, `SearchRepository.cs`.

**Approach:**
- Add `SearchCustomFieldsAsync(workspaceId, keyword, take, ct)` to `ISearchRepository` + `SearchRepository`: ILike on `CustomFieldValue.Value` joined to task → project (workspace-scoped).
- Add a `TaskItemSearchRow`-like result record (task id/title/key + field name/value) in `SearchQuery.cs`.
- Wire into `SearchQueryHandler` as an extra parallel query; add the new group to `SearchResult` + `SearchPagination` totals.

### Acceptance criteria
- `TeamReportTrends` returns real deltas when previous-period data exists.
- `/search?sortBy=title&sortDir=asc` orders results accordingly.
- Custom field values are searchable via ILIKE.
- `dotnet build` + `dotnet test` green.

---

## Notes
- Keep changes within backend scope. Don't touch `frontend/` or `api.ts`.
- The search response shape is consumed by Agent C (frontend) — if you add a new group, coordinate the field names with the team lead so C28.2 can type against it. Keep additive.
- Open ONE PR containing both tasks when green; ping the team lead for review.
