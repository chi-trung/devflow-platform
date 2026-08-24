# 🚀 Sprint 29 — Agent D (Frontend + i18n): Settings UI + i18n Completion

**Role:** Frontend Developer (React 18 + TypeScript + Tailwind + i18n)
**Branch:** `feat/frontend-sprint29-settings-i18n` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green. Do NOT touch shared files without locking: `api.ts` (lock with C), `types/api.ts` (lock with C), `i18n/*.json` (lock with C), `TasksController.cs` / backend — not your scope.

---

## Your scope: 2 tasks

### D29.1 — Workspace / Sprint / Template edit UI

**Files:** `frontend/src/pages/WorkspacePage.tsx`, `frontend/src/components/board/SprintBar.tsx`, `frontend/src/pages/TemplatesPage.tsx`, `frontend/src/lib/api.ts` (add `updateWorkspace`/`updateSprint`/`updateTemplate`), `frontend/src/types/api.ts`, i18n

Agent A (backend) is adding `PUT /workspaces/{id}` (name, description), `PUT .../sprints/{sprintId}` (name, goal), `PUT .../templates/{templateId}` (name, description). Build the UI:

1. **Workspace edit:**
   - In `WorkspacePage.tsx` header, next to the workspace name, add an **Edit (pencil) button** — visible only when the current user is an Admin (check the workspace member's role; use the same `canManageProjects`/role check pattern already used in the page for project edit).
   - Opens the existing `Dialog` (from `components/ui/Dialog.tsx`) with **Name** + **Description** fields pre-filled.
   - Save → `updateWorkspace(wsId, { name, description })` → toast success → refetch workspace.
   - Validation: name required; show inline error otherwise.

2. **Sprint edit:**
   - In `SprintBar.tsx` (the sprint header on the board), add an **Edit (pencil) button** next to the sprint name — Admin-gated.
   - Opens a `Dialog` with **Name** + **Goal** fields pre-filled.
   - Save → `updateSprint(wsId, projectId, sprintId, { name, goal })` → toast → refetch sprints.
   - Do NOT let the goal field be required (a sprint can have no goal).

3. **Template edit:**
   - In `TemplatesPage.tsx`, on each template card add an **Edit (pencil) button** — Admin-gated (match the page's existing role gating for the delete button).
   - Opens a `Dialog` with **Name** + **Description** fields.
   - Save → `updateTemplate(wsId, projectId, templateId, { name, description })` → toast → refetch templates.

4. **`api.ts` additions:**
   - `updateWorkspace(id, body)` → `PUT /workspaces/{id}`
   - `updateSprint(wsId, projectId, sprintId, body)` → `PUT .../sprints/{sprintId}`
   - `updateTemplate(wsId, projectId, templateId, body)` → `PUT .../templates/{templateId}`
   - Add request/response types to `types/api.ts` matching the backend shapes (check the merged backend PR for exact DTO names/fields — coordinate with Agent A's merged `UpdateWorkspaceCommand` response).

5. **i18n:** add `workspace.editTitle`, `workspace.editSave`, `workspace.editFailed`, `sprint.editTitle`, `sprint.editSave`, `sprint.editFailed`, `template.editTitle`, `template.editSave`, `template.editFailed`, `common.save` if missing — to BOTH `en.json` and `vi.json`.

**Acceptance:**
- Workspace/sprint/template edit dialogs open, pre-fill, save via API, toast + refetch.
- Edit buttons hidden for non-Admin users.
- `npm run build` green; i18n parity green.

---

### D29.2 — Translate remaining 122 vi.json keys + AppShell notification badge

**Files:** `frontend/src/i18n/vi.json`, `frontend/src/components/AppShell.tsx`, `frontend/src/hooks/useNotifications.ts`, `frontend/src/lib/api.ts` (add `getUnreadCount` if not present), i18n

1. **vi.json completion:** The i18n parity test (`frontend/src/__tests__/i18n-parity.test.ts`) currently allows identical values, but there are **122 keys in `vi.json` identical to `en.json`** that are untranslated (mainly in `label`, `customField`, `webhook`, `github`, `importExport`, `sprint`, `reports`, `taskCard`, `myTasks`, `dashboard`, `nav`, `pat` sections). Translate the **values** to natural Vietnamese. Rules:
   - Do **NOT** add or remove any keys — only change string values. Key matching must stay 100% (both directions).
   - Keep interpolation placeholders intact: `{{name}}`, `{{count}}`, `{{start}}`, `{{end}}`, `{{title}}`, `{{workspace}}`, etc. — the surrounding Vietnamese sentence must keep the same placeholder names.
   - Keep technical terms like "Sprint", "Backlog", "Cycle Time" in English where they're jargon (fine to keep as-is if a natural translation reads better — e.g. "Tồn đọng" for Backlog is acceptable but "Backlog" is also fine; be consistent per term).
   - Run `npm test` (or the specific i18n-parity test) to verify: the test must pass AFTER your translation with key matching intact.

2. **AppShell notification badge:**
   - In `AppShell.tsx`, the sidebar nav has a "Notifications" item (bell icon). Add an **unread count badge** (red dot with number, `99+` cap) to the bell/nav item.
   - Reuse the existing `useNotifications` hook IF AppShell already consumes it (check). If not, create a lightweight `useUnreadCount` hook that polls `GET /notifications/unread-count` every 60s (do NOT load the full list) — cheaper than the full notification stream. Use SignalR's incoming `notification` event to bump the count live if already connected.
   - Show `0`/empty state as no badge (or a subtle dot when there are any unread — pick the pattern the NotificationsPanel uses for its `unreadCount` badge and match it).
   - i18n aria-label: `nav.unreadNotifications` with `{ count }`.

**Acceptance:**
- `vi.json` has all 122 previously-identical keys translated to Vietnamese; placeholders preserved.
- `npm run build` + i18n parity test green (key matching 100%).
- AppShell notification bell shows unread count badge; updates live.
- `npm run build` green; i18n parity green.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts` / `i18n/*.json`** are shared with Agent C. C adds `uploadTaskAttachment` + bulk signatures; D adds `updateWorkspace`/`updateSprint`/`updateTemplate` + `getUnreadCount`. Rebase before opening the PR so both sets of functions coexist; do NOT delete each other's additions.
- **vi.json translation scope:** Agent C is ALSO adding new keys (bulk/attachment UX) to the same file. Coordinate: if C's keys land first, translate your 122 + keep C's new keys (translate C's new keys to Vietnamese too so the parity test stays green on values). The test only checks KEY matching, so new keys from C are fine — just make sure both files stay in sync.
- **Backend PUT endpoints** land via Agent A's PR. If A hasn't merged by the time you test, verify your `api.ts` signatures against the merged shapes once A lands, and note it in your PR body.
- `AppShell.tsx` is a shared file — D is the only agent touching it this sprint (notification badge). Work on your branch; note it in the PR body.

## 🚀 Definition of Done
- [ ] D29.1 workspace/sprint/template edit UI (Admin-gated, Dialog, save via API)
- [ ] D29.2 122 vi.json keys translated + AppShell unread badge
- [ ] `npm run build` green; i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts`/i18n conflicts (rebase if needed)
