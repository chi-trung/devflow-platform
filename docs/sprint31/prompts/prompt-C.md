# 🚀 Sprint 31 — Agent C (Frontend): Project Member UI + DLQ Batch Actions

**Role:** Frontend Developer (React 19 + TypeScript + Tailwind + i18n)
**Branch:** `feat/frontend-sprint31-member-dlq-batch` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green. Do NOT touch shared files without locking: `api.ts` (lock with D), `types/api.ts` (lock with D), `i18n/*.json` (D owns these — you do NOT add new keys).

---

## Your scope: 2 tasks

### C31.1 — Project settings member management

**Files:** `frontend/src/pages/ProjectSettingsPage.tsx` (find or create), `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, `frontend/src/i18n/en.json` + `vi.json` (add `projectMember.*` keys)

Agent A ships the backend endpoints (A31.2). Your job: the UI.

**API client additions (api.ts):**
```ts
export function getProjectMembers(workspaceId: string, projectId: string): Promise<ProjectMemberResponse[]>
export function addProjectMember(workspaceId: string, projectId: string, userId: string, role: string): Promise<ProjectMemberResponse>
export function updateProjectMemberRole(workspaceId: string, projectId: string, userId: string, role: string): Promise<void>
export function removeProjectMember(workspaceId: string, projectId: string, userId: string): Promise<void>
```

**Type (types/api.ts):**
```ts
export interface ProjectMemberResponse {
  userId: string;
  username: string;
  displayName: string;
  role: "Manager" | "Member";
}
```

**UI on ProjectSettingsPage:**
- If the page doesn't exist yet, create it. If it does, add a "Members" section below existing settings.
- **Section content:** `<h2>` + table/list with avatar + name + role badge + Manage/Remove actions.
- **Add member:** text input searching workspace members (filter out those already in the project) + role picker (Member/Manager) + Add button. Admin-gated (`workspace.role === "Owner" || workspace.role === "Admin"`).
- **Role change:** inline dropdown (Manager-gated).
- **Remove:** trash icon → ConfirmDialog (can't remove self). Admin-gated.
- **Loading/error states:** loading skeleton, error alert, empty state (`UserPlus` icon).
- **i18n keys** (add to BOTH en.json + vi.json — D coordinates i18n, but these are for YOUR component; D does NOT add projectMember keys):
  ```json
  "projectMember": {
    "title": "Members",
    "addMember": "Add member",
    "removeMember": "Remove",
    "removeConfirm": "Remove {name} from this project?",
    "role": "Role",
    "member": "Member",
    "manager": "Manager",
    "noMembers": "No members",
    "addSuccess": "Member added",
    "removeSuccess": "Member removed",
    "roleUpdated": "Role updated"
  }
  ```

### C31.2 — DLQ Replay-all / Purge buttons

**Files:** `frontend/src/pages/WebhooksPage.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`

Agent B ships the backend batch endpoints (B31.1). Extend your existing DLQ section (Sprint 30 C30.2):

**API client additions:**
```ts
export async function replayAllDeadLetterMessages(workspaceId: string): Promise<{ requeued: number }>
export async function purgeDeadLetterMessages(workspaceId: string): Promise<void>
```

**UI:**
- In the DLQ section header, add two buttons next to the existing Refresh:
  - **Replay all** — calls `replayAllDeadLetterMessages`, shows toast `t("outbox.replayAllSuccess", { count })`, reloads list.
  - **Purge** — calls `ConfirmDialog` first (destructive, red), then `purgeDeadLetterMessages`, toast `t("outbox.purgeSuccess")`, reloads list.
- Loading state per action (`replayingAll` / `purging` state vars), buttons disabled while loading.
- **No new i18n keys** — D31.2 owns the `outbox.replayAll*` / `outbox.purge*` keys. Reference them via `t("outbox.replayAllSuccess")` etc. They'll exist by the time D finishes.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts`** — shared with Agent D. D adds epic-dep functions + types. Coordinate: if D's PR lands first, rebase and merge both sets; do NOT delete each other's additions.
- **`i18n/*.json`** — D owns outbox batch keys. You add `projectMember.*` keys (your component's text). Do NOT add outbox keys — just reference them.
- **`WebhooksPage.tsx`** — you extended it in Sprint 30 (C30.2). This task extends it again. Commit your current work before starting if you have uncommitted changes.

## 🚀 Definition of Done
- [ ] C31.1 Project member management UI (add/role/remove), loading/error/empty states
- [ ] C31.2 DLQ Replay-all + Purge buttons with ConfirmDialog
- [ ] `npm run build` + i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts`/i18n conflicts (rebase if needed)