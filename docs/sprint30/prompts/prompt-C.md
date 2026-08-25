# 🎨 Sprint 30 — Agent C (Frontend): Watcher List UI + DLQ Admin UI

**Role:** Frontend Developer (React 18 + TypeScript + Tailwind + SWR-ish `api()` cache + i18n)
**Branch:** `feat/frontend-sprint30-watchers-dlq` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green. Do NOT touch shared files without locking: `api.ts` (lock with D), `types/api.ts` (lock with D), `i18n/*.json` (D owns the new `outbox.*` keys this sprint — do NOT edit them).

---

## Your scope: 2 tasks

### C30.1 — Watcher list in `TaskDetailPanel.tsx`

**Files:** `frontend/src/types/api.ts` (add `TaskWatcherResponse`), `frontend/src/lib/api.ts` (add `getTaskWatchers`), `frontend/src/components/board/TaskDetailPanel.tsx`

The task detail panel has a watch/unwatch toggle but no way to see **who** is watching. Backend (Agent B, merged first) adds `GET /tasks/{taskId}/watchers` returning `[{ userId, username, displayName }]`.

1. **`types/api.ts`:** `interface TaskWatcherResponse { userId: string; username: string; displayName: string; }`
2. **`api.ts`:** `getTaskWatchers(workspaceId: string, projectId: string, taskId: string): Promise<TaskWatcherResponse[]>`
3. **`TaskDetailPanel.tsx`:**
   - Add `watchers` / `watchersLoading` state.
   - Fetch in a `useEffect` keyed on `task.id`, beside the existing `isWatchingTask` effect (around lines 92-105). On failure just clear the list (silent — non-critical data).
   - Render a **"Watchers" row** after the assignee select: a label + stacked `Avatar` components (`name={w.displayName || w.username}`, `id={w.userId}`, `size="sm"`) with names, and a count `t("task.watcherCount", { count })`. The `Avatar` component is `components/ui/Avatar.tsx`.
   - **Refetch after `toggleWatch`** completes so the list stays in sync when the current user starts/stops watching.
   - Show a small loading placeholder while `watchersLoading` (reuse `Skeleton`).
   - No remove UI — keep it minimal and read-only.

**Acceptance:**
- Task detail shows who is watching the task (avatars + names + count).
- Watching/unwatching updates the list live.
- `npm run build` green.

---

### C30.2 — DLQ admin UI on `WebhooksPage.tsx`

**Files:** `frontend/src/pages/WebhooksPage.tsx`, `frontend/src/types/api.ts` (add `DeadLetterMessageDto`), `frontend/src/lib/api.ts` (add `getDeadLetterMessages` + `replayDeadLetterMessage`)

The backend already has admin outbox DLQ endpoints (`GET /api/v1/workspaces/{workspaceId}/outbox/dead-letter`, `POST .../{messageId}/replay`). There is no UI to inspect/retry dead-lettered webhook messages. Build a section on the **existing** workspace-level webhooks page.

1. **`types/api.ts`:** `interface DeadLetterMessageDto { id: string; type: string; occurredAtUtc: string; processedAtUtc?: string; retryCount: number; error?: string; failedPermanentlyAt: string; }`
2. **`api.ts`:**
```ts
export function getDeadLetterMessages(workspaceId: string, batchSize = 100): Promise<DeadLetterMessageDto[]>
export async function replayDeadLetterMessage(workspaceId: string, messageId: string): Promise<void>
```
3. **`WebhooksPage.tsx`:** Add a "Dead Letter Queue" section **below** the webhook list:
   - **Admin-gated:** render only when the page's workspace role is Owner/Admin (the page already checks this — reuse the same variable/pattern). Non-admins see nothing.
   - **Loading/error:** reuse the page's existing skeleton + error patterns; a failed load shows `t("outbox.dlqLoadFailed")`.
   - **List rows:** Type (mono, font-medium), Error (truncate with `title` tooltip for the full message), Retry-count badge, "Occurred" + "Failed permanently" timestamps via the page's existing `formatDate`.
   - **Replay button** per row with a `replayingId` loading state (same pattern as the existing `testingId` for webhook test-fire). On success toast `t("outbox.replaySuccess")` and reload the list; on failure toast `t("outbox.replayFailed")`.
   - **Empty state:** `<EmptyState icon={<Inbox className="size-8 text-muted-foreground/40" />} title={t("outbox.dlqEmpty")} description={t("outbox.dlqDescription")} />` — import `EmptyState` from `../components/ui/EmptyState`.
   - **No i18n keys added here** — Agent D owns the `outbox.*` keys. Reference them; they will exist by merge time (if D's PR lands first, the keys are already there).

**Acceptance:**
- Dead-lettered messages are listed with type, error, retries, timestamps.
- Replay re-queues a message, toasts, reloads the list.
- Section hidden for non-Admin users.
- `npm run build` green; i18n parity green.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts` / `i18n/*.json`** are shared. C owns the `TaskWatcherResponse` + `DeadLetterMessageDto` types and the `getTaskWatchers`/`getDeadLetterMessages`/`replayDeadLetterMessage` functions. D owns the `outbox.*` i18n keys and touches ONLY the i18n JSON. Coordinate: if D's PR lands first, rebase and keep both sets. Do NOT edit i18n JSON yourself.
- **Backend shape:** the watchers endpoint returns `{ userId, username, displayName }`. Confirm against Agent B's merged PR if the wire shape differs.
- `TaskDetailPanel.tsx` is large (~1000 lines). Make focused edits; reuse existing `useEffect`/`Skeleton`/`Avatar` patterns. Do not rewrite the panel.

## 🚀 Definition of Done
- [ ] C30.1 Watcher list (avatars + names + count) in `TaskDetailPanel`, refetches after toggle
- [ ] C30.2 DLQ section on `WebhooksPage` with list + per-row replay + Admin gate
- [ ] `npm run build` green; i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts` conflicts (rebase if needed)
