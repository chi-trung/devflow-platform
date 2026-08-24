# 🚀 Sprint 29 — File Upload Safety & Settings Polish

**Status:** Planning
**Branch base:** `main`
**Branch convention:** `feat/backend-sprint29-<feature>` (A/B) / `feat/frontend-sprint29-<feature>` (C/D)
**Updated:** 2026-08-24

---

## Why This Sprint 29

Sprint 28 merged (PRs #124–131): webhook DLQ fix, testing + reporting/search, project settings UI + Dialog/EmptyState, workspace analytics + mention filter + vi.json, optimistic auth + activity pagination, keepalive `/api/v1/ping` probe. A survey of `origin/main` found the **highest-impact remaining gaps**:

1. **File uploads have NO size limit or type validation** — `UploadTaskAttachment` stores the entire blob in PostgreSQL (`bytea` column). On Render's 512 MB RAM, uploading a 100 MB file crashes the app. No `[RequestSizeLimit]`, no file-type whitelist. *(P0 — crash risk.)*
2. **No workspace rename/edit** — `WorkspacesController` has create/list/delete/members but no `PUT` to update name/description. *(UX gap.)*
3. **No sprint rename/edit** — `SprintsController` has create/start/complete/rollover/delete but no `PUT` to update name/goal. *(UX gap.)*
4. **No template update** — `TemplatesController` has list/create/apply/delete but no `PUT` to rename/edit. *(UX gap.)*
5. **122 i18n keys still untranslated in vi.json** — label/customField/webhook/github/sections identical to English. *(i18n parity.)*
6. **Bulk operations UI needs polish** — backend has bulk-move/assign/delete, board has `selectedIds` state, but no select-all checkbox on column header, no floating batch action bar, no bulk-edit labels. *(UX depth.)*
7. **Notification unread count badge not in AppShell sidebar** — notifications panel has `unreadCount` but `AppShell.tsx` nav item shows no badge. *(UX gap.)*
8. **Attachment upload has no frontend progress/error state** — `TaskDetailPanel.tsx` calls `uploadTaskAttachment` but has no loading spinner, no progress bar, no error toast on failure. *(UX gap.)*

---

## 🎯 Work Assignment

| Agent | Scope | Branch Prefix | Tasks |
|---|---|---|---|
| **A (Team Lead)** | Backend — file upload safety + workspace/sprint/template settings | `feat/backend-sprint29-*` | A29.1 File upload size limit + type whitelist, A29.2 Workspace PUT + Sprint PUT + Template PUT, A29.3 Review/merge B/C/D |
| **B (Backend)** | Backend settings + attachment endpoints | `feat/backend-sprint29-*` | B29.1 Attachment repository cleanup + download caching, B29.2 Notification unread-count-enhance + batch-delete, B29.3 Tests for new endpoints |
| **C (Frontend)** | Bulk ops UX + attachment upload UX | `feat/frontend-sprint29-*` | C29.1 Bulk operations UI (select-all column header, batch action bar, bulk-edit labels), C29.2 Attachment upload progress/error/retry |
| **D (Frontend + i18n)** | Workspace/sprint settings UI + i18n completion | `feat/frontend-sprint29-*` | D29.1 Workspace name/description edit UI + Sprint name/goal edit UI + Template edit UI, D29.2 Translate remaining 122 keys in vi.json + AppShell notification badge |

---

## 🤖 Agent A — File Upload Safety + Backend Settings (Team Lead)

### A29.1 — File upload size limit + type whitelist
**Files:** `src/DevFlow.Api/Controllers/TasksController.cs`, `src/DevFlow.Application/Features/Tasks/Attachments/UploadTaskAttachmentCommand.cs`, `src/DevFlow.Application/Features/Tasks/Attachments/UploadTaskAttachmentCommandHandler.cs`, `appsettings.json`

**Problem:** `UploadTaskAttachment` stores `byte[]` data directly in PostgreSQL (no file-size check, no type validation). A 100 MB upload will OOM Render's 512 MB container.

**Approach:**
- Add `[RequestSizeLimit(10 * 1024 * 1024)]` (10 MB) to the `UploadAttachment` action in `TasksController.cs`.
- Add `[RequestFormLimits(MultipartBodyLengthLimit = 10_485_760)]` to the same action.
- Add file-type whitelist validation in `UploadTaskAttachmentCommandHandler` (allow: `image/*`, `application/pdf`, `text/*`, `application/json`, `application/vnd.openxmlformats-officedocument.*`, `application/vnd.ms-excel`). Reject with `BadRequest` + descriptive message.
- Add `MaxFileSize` property to `UploadTaskAttachmentCommand` (default 10 MB) and validate in handler.
- Log rejected uploads as warnings.
- Configure `Kestrel:MaxRequestBodySize` in `appsettings.json` (set to 10_485_760).

**Acceptance criteria:**
- Uploads > 10 MB return 413 Payload Too Large (or 400 BadRequest) before reaching handler.
- Suspicious file types (`.exe`, `.dll`, `.bat`, `.sh`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.scr`) rejected with 400.
- Allowed types pass through. Existing tests pass.
- `dotnet build` + `dotnet test` green.

### A29.2 — Workspace PUT + Sprint PUT + Template PUT
**Files:** `src/DevFlow.Api/Controllers/WorkspacesController.cs`, `src/DevFlow.Application/Features/Workspaces/` (new `Update/`), `src/DevFlow.Api/Controllers/SprintsController.cs`, `src/DevFlow.Application/Features/Sprints/` (new `Update/`), `src/DevFlow.Api/Controllers/TemplatesController.cs`, `src/DevFlow.Application/Features/Templates/` (new `Update/`)

**Problem:** No way to rename workspace, sprint, or template — all missing PUT endpoints.

**Approach:**
- **Workspace PUT:** Create `UpdateWorkspaceCommand` + `UpdateWorkspaceCommandHandler` (name, description). Add `HttpPut("{id:guid}")` to `WorkspacesController`. Admin-gated (`[RequireWorkspaceRole(WorkspaceRole.Admin)]`).
- **Sprint PUT:** Create `UpdateSprintCommand` + `UpdateSprintCommandHandler` (name, goal). Add `HttpPut("{sprintId:guid}")` to `SprintsController`. Admin-gated.
- **Template PUT:** Create `UpdateTemplateCommand` + `UpdateTemplateCommandHandler` (name, description). Add `HttpPut("{templateId:guid}")` to `TemplatesController`. Admin-gated.
- Each handler validates existence + workspace-scoping, returns updated response.
- 2+ unit tests per new handler.

**Acceptance criteria:**
- Workspace name/description can be updated via API.
- Sprint name/goal can be updated via API.
- Template name/description can be updated via API.
- All endpoints are Admin-gated. 401/403 for non-members.
- `dotnet build` + `dotnet test` green.

### A29.3 — Review & merge B/C/D PRs
- Review each PR, run `dotnet test` / `npm run build` + i18n parity, merge when green, update `AGENT_STATUS.md`.

---

## 🤖 Agent B — Backend Settings + Attachment Depth

### B29.1 — Attachment repository cleanup + download caching
**Files:** `src/DevFlow.Infrastructure/Persistence/Repositories/TaskAttachmentRepository.cs`, `src/DevFlow.Application/Common/Interfaces/ITaskAttachmentRepository.cs`, `src/DevFlow.Application/Features/Tasks/Attachments/DownloadTaskAttachmentQuery.cs`, `src/DevFlow.Api/Controllers/TasksController.cs`

**Approach:**
- Add `GetAttachmentsForTaskAsync` with pagination support to `ITaskAttachmentRepository` (currently only `GetByTaskIdAsync` — check if paginated).
- Add `DeleteAttachmentsForTaskAsync(Guid taskId)` for bulk cleanup (used when deleting a task).
- Add `ETag` / `Last-Modified` response headers to `DownloadAttachment` for browser caching (return `File(fileResult.Data, fileResult.ContentType, fileResult.FileName, lastModified)`).
- Add `Content-Disposition` header: `inline` for images/PDFs, `attachment` for others.

**Acceptance criteria:**
- `GetAttachmentsForTaskAsync` supports skip/take pagination.
- Download returns proper cache headers + Content-Disposition.
- `dotnet build` + `dotnet test` green.

### B29.2 — Notification unread-count enhance + batch-delete
**Files:** `src/DevFlow.Application/Features/Notifications/`, `src/DevFlow.Api/Controllers/NotificationsController.cs`, `src/DevFlow.Domain/Entities/Notification.cs`

**Approach:**
- Add `POST /api/v1/notifications/batch-delete` endpoint accepting `{ ids: guid[] }` — delete specific notifications by ID.
- Add `GET /api/v1/notifications/unread-count` (already exists — verify it returns count + last notification timestamp). If exists, ensure it's efficient (single query, no N+1).
- Add `GET /api/v1/notifications/unread-count?workspaceId={id}` — optional workspace filter for per-workspace badge.

**Acceptance criteria:**
- Batch-delete endpoint deletes specified notifications, returns deleted count.
- Unread-count endpoint is efficient (< 50ms) and optionally filtered by workspace.
- `dotnet build` + `dotnet test` green.

### B29.3 — Tests for new endpoints
- Integration tests for attachment upload size limit + type validation.
- Unit tests for Workspace PUT, Sprint PUT, Template PUT, notification batch-delete.
- Target: ≥8 new tests.

---

## 🎨 Agent C — Bulk Operations UX + Attachment Upload UX

### C29.1 — Bulk operations UI (select-all column header, batch action bar, bulk-edit labels)
**Files:** `frontend/src/pages/BoardPage.tsx`, `frontend/src/components/board/FilterBar.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n

**Problem:** Backend supports bulk-move/assign/delete, and `BoardPage.tsx` has `selectedIds` state + keyboard shortcuts, but there's no select-all checkbox on column headers, no floating batch action bar, no bulk-edit labels.

**Approach:**
- Add select-all checkbox to each column header (selects all visible tasks in that column). When selected, the column checkbox shows indeterminate state if only some are selected.
- Add a floating batch action bar (appears when `selectedIds.size > 0`) with:
  - Status dropdown (bulk move: Backlog/InProgress/InReview/Done)
  - Assignee dropdown (bulk assign)
  - Labels dropdown (bulk add/remove labels — check if backend supports bulk label operations)
  - Delete button (with confirmation dialog)
  - "Clear selection" link
  - Count badge: "N selected"
- Wire to existing `bulkMoveTasks`, `bulkAssignTasks`, `bulkDeleteTasks` in `api.ts`.
- If no bulk-label endpoint exists, add a `POST /tasks/bulk/labels` endpoint (AddLabels/RemoveLabels) — or scope to existing endpoints only.
- Keyboard: `Ctrl+A` selects all visible, `Escape` clears selection.
- i18n keys for all new labels.

**Acceptance criteria:**
- Column header checkbox selects all tasks in that column.
- Floating batch action bar appears with status/assignee/delete actions.
- Bulk operations complete and board refreshes.
- `npm run build` green; i18n parity green.

### C29.2 — Attachment upload progress/error/retry
**Files:** `frontend/src/components/board/TaskDetailPanel.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n

**Problem:** Attachment upload in `TaskDetailPanel.tsx` has no loading state, no progress bar, no error handling.

**Approach:**
- Add upload progress tracking using `XMLHttpRequest` (not `fetch`) for `progress` event, OR use `fetch` with `ReadableStream` (if available). Show a progress bar per file during upload.
- Add file-type validation client-side (reject `.exe`, `.dll`, `.bat`, `.sh`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.scr` before sending).
- Add file-size validation client-side (reject > 10 MB before sending).
- Show upload error state with retry button per failed file.
- Show upload queue (multiple files can be added; each uploads in sequence).
- Max 5 files per upload session (UX constraint).
- i18n keys for error messages (file too large, type not allowed, upload failed).

**Acceptance criteria:**
- Uploading shows progress bar per file.
- Invalid file types rejected client-side before upload.
- Files > 10 MB rejected client-side.
- Upload failure shows error + retry button.
- `npm run build` green; i18n parity green.

---

## 🚀 Agent D — Settings UI + i18n Completion

### D29.1 — Workspace/sprint/template edit UI
**Files:** `frontend/src/pages/WorkspacePage.tsx`, `frontend/src/components/board/SprintBar.tsx`, `frontend/src/pages/TemplatesPage.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n

**Approach:**
- **Workspace edit:** Add "Edit" button (gear icon) next to workspace name in `WorkspacePage.tsx` header. Opens a Dialog with name + description fields. Calls `updateWorkspace` API. Admin-gated (check `canManageProjects` or `role === "Admin"`).
- **Sprint edit:** Add "Edit" button to sprint bar (next to sprint name) in `SprintBar.tsx`. Opens inline edit or small Dialog with name + goal fields. Calls `updateSprint` API. Admin-gated.
- **Template edit:** Add "Edit" button to template cards in `TemplatesPage.tsx`. Opens Dialog with name + description fields. Calls `updateTemplate` API. Admin-gated.
- Add `updateWorkspace`, `updateSprint`, `updateTemplate` to `api.ts`.
- Add request types to `types/api.ts`.
- i18n keys for all dialogs.

**Acceptance criteria:**
- Workspace name/description editable via Dialog + save persists.
- Sprint name/goal editable via Dialog + save persists.
- Template name/description editable via Dialog + save persists.
- All edit buttons hidden for non-Admin users.
- `npm run build` green; i18n parity green.

### D29.2 — Translate remaining 122 i18n keys + AppShell notification badge
**Files:** `frontend/src/i18n/vi.json`, `frontend/src/components/AppShell.tsx`, `frontend/src/hooks/useNotifications.ts` (or `useUnreadCount.ts`), `frontend/src/lib/api.ts`

**Approach:**
- **vi.json translation:** Translate the 122 keys currently identical to English (identified by i18n parity test). These are mainly in `label`, `customField`, `webhook`, `github`, `importExport`, `sprint`, `reports`, `taskCard`, `myTasks`, `dashboard`, `nav`, `pat` sections. Do NOT add/remove any keys — only translate string values to Vietnamese. The i18n parity test enforces key matching.
- **AppShell notification badge:** Add an unread notification count badge to the notification bell icon in `AppShell.tsx` sidebar nav. Use `useNotifications` hook's `unreadCount` (or a new lightweight `useUnreadCount` hook that polls `GET /notifications/unread-count` every 60s). Show a red dot with count (max 99+). If the user is on a page with NotificationsPanel, the panel already has the badge — but the sidebar bell should also show it.
- If `useNotifications` is already loaded in AppShell, reuse its `unreadCount` directly. If not, create a lightweight `useUnreadCount` hook that only fetches the count (not the full list).
- i18n keys for badge aria-label.

**Acceptance criteria:**
- `vi.json` has all 122 previously-identical keys translated to Vietnamese.
- `npm run build` + i18n parity test green.
- AppShell notification bell shows unread count badge (red dot + number).
- Badge updates when new notification arrives (via SignalR or poll).
- `npm run build` green; i18n parity green.

---

## 🧭 Deferred to Sprint 30+

- **Project-level member management / RBAC** — needs a product decision on the data model; full design sprint.
- **Webhook/outbox admin UI** — backend DLQ endpoint done in A28.1; full admin page (DLQ inspection, manual replay, retry-all) deferred.
- **Search relevance ranking / tsvector** — beyond ILIKE; revisit if search UX demands it.
- **Integration test expansion** — single file still; needs a dedicated test-infra sprint.
- **Time tracking reporting** — weekly timesheet, per-user aggregated time, time-by-project.
- **Watcher list UI** — show who is watching a task in TaskDetailPanel.
- **Epic-to-epic dependency** — epic-level dependency graph beyond task-level.
- **Custom field grouping/sectioning** — organize fields on task detail.

---

## 📦 Quality Gates (all PRs)

- Backend: `dotnet build` + `dotnet test` 100% green.
- Frontend: `npm run build` (tsc strict) green; i18n parity for any new keys (add to BOTH `en.json` and `vi.json`).
- Shared files single-agent lock: `api.ts`, `types/api.ts`, `i18n/*.json`, `AppShell.tsx`, `TasksController.cs`, `WorkspacesController.cs`.
- Each PR targets `main`, follows branch convention, conventional commits.

## ✅ Definition of Done (Sprint 29)

- [ ] A29.1 File upload size limit + type whitelist (413/400 validation)
- [ ] A29.2 Workspace PUT + Sprint PUT + Template PUT
- [ ] A29.3 Review & merge B/C/D PRs; AGENT_STATUS.md → Sprint 29 Complete
- [ ] B29.1 Attachment repository pagination + download cache headers
- [ ] B29.2 Notification batch-delete + unread-count enhancement
- [ ] B29.3 Tests for new endpoints (≥8 new tests)
- [ ] C29.1 Bulk operations UI (select-all column header, batch action bar)
- [ ] C29.2 Attachment upload progress/error/retry UX
- [ ] D29.1 Workspace/sprint/template edit UI
- [ ] D29.2 vi.json 122 keys translation + AppShell notification badge

---

## After Approval (execution)

1. Write `docs/sprint29/prompts/prompt-{B,C,D}.md`.
2. Update `AGENT_STATUS.md` (Sprint 28 → Complete; Sprint 29 row with A29.1-3, B29.1-3, C29.1-2, D29.1-2).
3. Commit + push plan to main, open PR (Agent A planning/review only).
4. Begin A29.1 (file upload safety) on `feat/backend-sprint29-upload-safety`, then review B/C/D PRs as they land.