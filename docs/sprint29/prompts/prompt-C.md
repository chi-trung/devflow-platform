# 🎨 Sprint 29 — Agent C (Frontend): Bulk Operations UX + Attachment Upload UX

**Role:** Frontend Developer (React 18 + TypeScript + Tailwind + SWR-ish `api()` cache + i18n)
**Branch:** `feat/frontend-sprint29-bulk-attachments` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green (any new key in BOTH `en.json` and `vi.json`). Do NOT touch shared files without locking: `api.ts` (lock with D), `types/api.ts` (lock with D), `i18n/*.json` (lock with D).

---

## Your scope: 2 tasks

### C29.1 — Bulk operations UI (select-all column header + batch action bar)

**Files:** `frontend/src/pages/BoardPage.tsx`, `frontend/src/components/board/FilterBar.tsx`, `frontend/src/lib/api.ts` (read-only additions — check `bulkMoveTasks`/`bulkAssignTasks`/`bulkDeleteTasks` already exist), `frontend/src/types/api.ts`, i18n

The backend already has `POST /tasks/bulk/move`, `/assign`, `/delete`. `BoardPage.tsx` already has `selectedIds` state + `runBulk()` + `Ctrl+A`/`Delete`/`Escape` keyboard shortcuts. Your job is to make it **discoverable and complete**:

1. **Select-all checkbox per column header:**
   - Each column header gets a checkbox that selects all visible tasks in that column.
   - If some (but not all) visible tasks in the column are selected → indeterminate state.
   - Clicking it again clears that column's selection.

2. **Floating batch action bar:**
   - When `selectedIds.size > 0`, show a fixed/sticky action bar (bottom of board or top of filter bar) with:
     - `{t("board.nSelected", { count })}` count badge
     - **Status dropdown** → bulk move (Backlog/InProgress/InReview/Done)
     - **Assignee dropdown** → bulk assign (list workspace members via existing endpoint)
     - **Labels dropdown** → bulk add/remove labels — **only if the backend supports it** (check `api.ts` for a bulk-label function; if absent, add a client-side note in your PR body that bulk-label needs a backend endpoint, and skip it — scope to move/assign/delete only).
     - **Delete button** (red, opens existing `ConfirmDialog` with "Delete N tasks?" confirmation)
     - **"Clear selection" link**
   - Wire to existing `bulkMoveTasks`/`bulkAssignTasks`/`bulkDeleteTasks`.
   - After success: `push(toast)`, clear `selectedIds`, refresh board (`scheduleReload` or refetch).
   - Loading state on the action buttons while a bulk op runs; disable the bar while running.

3. **Keyboard:** keep `Ctrl+A` (select visible) + `Escape` (clear) working; add a small hint in the bar: `Ctrl+A select all · Esc clear`.

4. **i18n:** add `board.nSelected`, `board.clearSelection`, `board.bulkMoveTo`, `board.bulkAssignTo`, `board.bulkDeleteTitle`, `board.bulkDeleteMessage`, `board.bulkActionRunning`, `board.selectAllColumn` to BOTH `en.json` and `vi.json`.

**Acceptance:**
- Column header checkbox selects/clears all visible tasks in that column (indeterminate when partial).
- Floating batch bar appears with count badge + move/assign/delete/clear actions.
- Bulk ops complete, toast shown, selection cleared, board refreshed.
- `npm run build` green; i18n parity green.

---

### C29.2 — Attachment upload progress/error/retry

**Files:** `frontend/src/components/board/TaskDetailPanel.tsx`, `frontend/src/lib/api.ts` (add `uploadTaskAttachment` with progress callback), `frontend/src/types/api.ts`, i18n

The attachment upload in `TaskDetailPanel.tsx` currently has no loading/progress/error state. Build a real upload UX:

1. **Progress tracking:** implement `uploadTaskAttachment(file, taskId, workspaceId, projectId, onProgress)` in `api.ts` using `XMLHttpRequest` (fires `progress` events) instead of `fetch`, so you get `upload` progress. Return a `Promise` that resolves to `TaskAttachmentResponse` and rejects on failure, with the progress callback invoked as `loaded`/`total`.
2. **Client-side validation (before sending):**
   - Reject size > 10 MB (`file.size > 10 * 1024 * 1024`) → toast `t("attachment.fileTooLarge")`, skip upload.
   - Reject dangerous extensions: `.exe .dll .bat .sh .cmd .ps1 .js .vbs .scr` → toast `t("attachment.typeNotAllowed")`, skip upload.
3. **Upload queue:**
   - Allow selecting multiple files (max 5 per session — show `t("attachment.maxFiles")` if exceeded).
   - Each file shows a row: filename, size, per-file progress bar, status (uploading / done / failed).
   - Uploads run sequentially (await each before next) to avoid hammering the server.
   - On success: remove the progress row, refetch the attachment list, toast success.
4. **Error + retry:** if a file fails, show an error state on its row with a **Retry** button that re-uploads just that file.
5. **i18n:** add `attachment.uploading`, `attachment.uploadFailed`, `attachment.retry`, `attachment.fileTooLarge`, `attachment.typeNotAllowed`, `attachment.maxFiles`, `attachment.uploadSuccess` to BOTH files.

**Acceptance:**
- Selecting files shows per-file progress bars during upload.
- Invalid type/size rejected client-side with a clear toast, never sent.
- Failed upload shows error + Retry; retry re-uploads just that file.
- Max 5 files per session enforced.
- `npm run build` green; i18n parity green.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts` / i18n files** are shared — Agent D also touches them. Coordinate: C adds `uploadTaskAttachment` + bulk call signatures; D adds `updateWorkspace`/`updateSprint`/`updateTemplate`. To avoid conflicts, work on your branch, and when opening the PR, note which `api.ts` functions you added so D can merge cleanly. If D's PR lands first, rebase and keep both sets of functions.
- Backend `TasksController.UploadAttachment` will get a `[RequestSizeLimit(10 MB)]` + type whitelist (Agent A). Match your 10 MB client-side limit to the server's.
- BoardPage is large (~1000 lines). Make focused edits; reuse the existing `selectedIds`/`runBulk`/`ConfirmDialog` patterns — do not rewrite the page.

## 🚀 Definition of Done
- [ ] C29.1 select-all column checkboxes + floating batch action bar
- [ ] C29.2 attachment upload progress/error/retry UX with client validation
- [ ] `npm run build` green; i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts`/i18n conflicts (rebase if needed)
