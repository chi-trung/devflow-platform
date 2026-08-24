# 🤖 Sprint 29 — Agent B (Backend): Settings + Attachment Depth

**Role:** Backend Developer (C# / .NET 8, Clean Architecture, CQRS+MediatR, EF Core + PostgreSQL)
**Branch:** `feat/backend-sprint29-attachments-notifications` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `dotnet build` + `dotnet test` 100% green. Do NOT touch shared files without locking: `TasksController.cs` (locked by A), `WorkspacesController.cs`, `SprintsController.cs`, `TemplatesController.cs` (locked by A).

---

## Your scope: 3 tasks

### B29.1 — Attachment repository pagination + download cache headers

**Files:** `src/DevFlow.Infrastructure/Persistence/Repositories/TaskAttachmentRepository.cs`, `src/DevFlow.Application/Common/Interfaces/ITaskAttachmentRepository.cs`, `src/DevFlow.Application/Features/Tasks/Attachments/DownloadTaskAttachmentQuery.cs`, `src/DevFlow.Api/Controllers/TasksController.cs` (only the download action)

The attachment feature currently stores full `byte[]` in PostgreSQL (`bytea` column). This task hardens the read path:

1. **Pagination:** Check `ITaskAttachmentRepository.GetByTaskIdAsync` — if it returns ALL attachments unfiltered, add `GetForTaskAsync(Guid taskId, int skip, int take)` returning `(List<TaskAttachment>, int totalCount)`. Wire it into `ListTaskAttachmentsQuery` / `ListTaskAttachmentsQueryHandler` with `page`/`pageSize` params so the task detail panel can load attachments lazily (first 10, "show more").
2. **Bulk cleanup:** Add `DeleteAttachmentsForTaskAsync(Guid taskId)` — ensure task deletion cascades attachments in the repository layer (verify the DB FK already cascades; if yes, make the repo method explicit anyway so the handler is testable).
3. **Cache headers:** In the `DownloadAttachment` action, return `File(fileResult.Data, fileResult.ContentType, fileResult.FileName, lastModified: fileResult.CreatedAtUtc)` and set a sensible `Cache-Control` header (e.g. `private, max-age=3600`) so browsers don't re-download unchanged files.
4. **Content-Disposition:** Return `inline` for `image/*` and `application/pdf`; `attachment` for everything else (so JS/exe/etc. can't auto-open).

**Acceptance:**
- `GetForTaskAsync` supports skip/take pagination + total count.
- `ListTaskAttachmentsQuery` accepts `page`/`pageSize`.
- Download returns `Last-Modified`, `Cache-Control`, correct `Content-Disposition`.
- `dotnet build` + `dotnet test` green.

---

### B29.2 — Notification batch-delete + unread-count enhancement

**Files:** `src/DevFlow.Api/Controllers/NotificationsController.cs`, `src/DevFlow.Application/Features/Notifications/` (new `BatchDelete/`), `src/DevFlow.Domain/Entities/Notification.cs`

1. **Batch delete:** Add `POST /api/v1/notifications/batch-delete` accepting `{ "ids": ["guid", ...] }`. New `BatchDeleteNotificationsCommand` + handler deletes only the current user's notifications whose IDs are in the list; returns `{ deleted = count }`. Add validator: empty list → validation error.
2. **Unread-count endpoint:** `GET /api/v1/notifications/unread-count` already exists — verify it's a single efficient query (no N+1). Add optional `?workspaceId={guid}` filter so the UI can show a per-workspace badge. Return `{ unreadCount, lastUnreadAt }`.

**Acceptance:**
- Batch-delete deletes only own notifications, returns deleted count.
- Unread-count is efficient + optionally workspace-filtered.
- `dotnet build` + `dotnet test` green.

---

### B29.3 — Tests for new endpoints

**Files (new):** `tests/DevFlow.UnitTests/Features/Attachments/`, `tests/DevFlow.UnitTests/Features/Notifications/BatchDeleteNotificationsCommandHandlerTests.cs`, `tests/DevFlow.UnitTests/Features/Workspaces/` (if A hasn't added), `tests/DevFlow.UnitTests/Features/Sprints/`, `tests/DevFlow.UnitTests/Features/Templates/`

NSubstitute-based handler tests mirroring existing patterns (`tests/DevFlow.UnitTests/Features/Sprints/DeleteSprintCommandHandlerTests.cs`). Target **≥8 new tests**:
- B29.1: attachment pagination returns paged subset + total; download sets content-disposition (≥3).
- B29.2: batch-delete deletes own + returns count; empty list validation fails (≥2).
- B29.3: if A29.2 endpoints exist by the time you land, add happy-path + not-found for `UpdateWorkspaceCommand`, `UpdateSprintCommand`, `UpdateTemplateCommand` (≥3). Coordinate with Agent A on the command shapes — read their merged PR first.

**Acceptance:** `dotnet test` green; no flaky/order-dependent tests.

---

## ⚠️ Coordination notes

- **Conflict risk with Agent A:** A29.2 creates `UpdateWorkspaceCommand`/`UpdateSprintCommand`/`UpdateTemplateCommand` in `src/DevFlow.Application/Features/{Workspaces,Sprints,Templates}/Update/`. Do NOT create these — only add TESTS for them after they land on main (or stub against their merged shapes). If A lands after you, skip the A29.2 tests and note it in your PR body.
- `TasksController.cs` upload action is locked by Agent A (size/type validation). Only touch the **download** action + attachment response type.
- Read `docs/sprint28/prompt-B.md` for the house style of prompt docs.

## 🚀 Definition of Done
- [ ] B29.1 attachment pagination + cache headers
- [ ] B29.2 notification batch-delete + unread-count workspace filter
- [ ] B29.3 ≥8 new unit tests green
- [ ] `dotnet build` + `dotnet test` green
- [ ] PR targets `main`, conventional commits, no shared-file conflicts
