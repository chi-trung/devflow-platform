# 🚀 Sprint 30 — Agent D (Frontend + i18n): EmptyState Adoption + DLQ i18n

**Role:** Frontend Developer (React 18 + TypeScript + Tailwind + i18n)
**Branch:** `feat/frontend-sprint30-emtystate-i18n` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green. Do NOT touch shared files without locking: `api.ts` (lock with C), `types/api.ts` (lock with C), `i18n/*.json` (yours — C does NOT touch these).

---

## Your scope: 2 tasks

### D30.1 — EmptyState adoption in 5 pages

**Files:** `frontend/src/pages/ActivitiesPage.tsx`, `frontend/src/pages/BoardPage.tsx`, `frontend/src/pages/CustomFieldsPage.tsx`, `frontend/src/pages/GitHubPage.tsx`, `frontend/src/pages/MyTasksPage.tsx`

Sprint 28 created the reusable `<EmptyState>` component (`frontend/src/components/ui/EmptyState.tsx`) but 27 files still hand-roll `border-dashed` empty states. Adopt the component in these **5** pages (the other 21 are deferred to Sprint 31+).

**Component signature:**
```ts
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
```
Renders `rounded-xl border border-dashed border-border bg-card/40 px-6 py-10 text-center` with the icon, title, optional description, optional action.

**Per page (find each hand-rolled empty state):**
1. `ActivitiesPage.tsx` — `Activity` icon, existing empty title/description keys.
2. `BoardPage.tsx` — `SquareKanban` icon (keep any existing icon chip wrapper styles), existing `board.empty`/`board.emptyDesc` keys.
3. `CustomFieldsPage.tsx` — page icon, existing `customField.emptyTitle`/`emptyDescription` keys, `action` = the existing "create field" button.
4. `GitHubPage.tsx` — `Github` icon, existing `github.emptyPrs`/`emptyPrsDescription` keys.
5. `MyTasksPage.tsx` — existing empty key + icon.

**Rules:**
- Preserve icons, i18n keys, and action buttons EXACTLY — only the wrapper markup changes.
- Import `EmptyState` from `../components/ui/EmptyState` (adjust relative path from each file's location).
- No new i18n keys — reuse the existing ones.
- Do NOT touch the other 21 `border-dashed` files.

**Acceptance:**
- 5 pages render their empty states via `<EmptyState>`.
- No visual regression (same icon/title/description/action, same dashed-card look).
- `npm run build` green; i18n parity green.

---

### D30.2 — DLQ i18n keys (en + vi)

**Files:** `frontend/src/i18n/en.json`, `frontend/src/i18n/vi.json`

Agent C builds a "Dead Letter Queue" section on `WebhooksPage.tsx` that references a new top-level `outbox.*` key namespace. Add it to BOTH files (keys MUST match exactly; `vi.json` values translated to Vietnamese, placeholders intact):

```json
"outbox": {
  "dlqTitle": "Dead Letter Queue",
  "dlqDescription": "Webhook messages that failed permanently after all retries. Inspect and replay them.",
  "dlqEmpty": "No dead-lettered messages",
  "dlqLoadFailed": "Failed to load dead-letter queue",
  "type": "Type",
  "error": "Error",
  "retryCount": "Retries",
  "occurredAt": "Occurred",
  "failedPermanentlyAt": "Failed permanently",
  "replay": "Replay",
  "replaying": "Replaying...",
  "replaySuccess": "Message re-queued for retry",
  "replayFailed": "Failed to re-queue message",
  "adminOnly": "Admin only"
}
```

`vi.json` values (translate naturally; keep jargon like "Dead Letter Queue" if a natural Vietnamese reads better — pick one and be consistent):
```
"outbox": {
  "dlqTitle": "Hàng đợi tin đã chết",
  "dlqDescription": "Các tin webhook thất bại vĩnh viễn sau khi thử lại. Xem và phát lại.",
  "dlqEmpty": "Không có tin nào trong hàng đợi đã chết",
  "dlqLoadFailed": "Không tải được hàng đợi đã chết",
  "type": "Loại",
  "error": "Lỗi",
  "retryCount": "Số lần thử",
  "occurredAt": "Xảy ra lúc",
  "failedPermanentlyAt": "Thất bại vĩnh viễn lúc",
  "replay": "Phát lại",
  "replaying": "Đang phát lại...",
  "replaySuccess": "Đã đưa tin trở lại hàng đợi để thử lại",
  "replayFailed": "Không đưa được tin trở lại hàng đợi",
  "adminOnly": "Chỉ dành cho quản trị viên"
}
```

**Acceptance:**
- `outbox.*` keys present in BOTH `en.json` and `vi.json`, values match exactly.
- i18n parity test (`npm test` → `src/__tests__/i18n-parity.test.ts`) green.
- `npm run build` green.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts` / `i18n/*.json`** are shared with Agent C. C adds `TaskWatcherResponse`, `DeadLetterMessageDto`, `getTaskWatchers`, `getDeadLetterMessages`, `replayDeadLetterMessage`; D adds ONLY the `outbox.*` i18n keys. Coordinate: if C's PR lands first, rebase and keep both sets; do NOT delete each other's additions.
- **EmptyState pages** — C also imports `EmptyState` in `WebhooksPage.tsx`. Both of you importing the component is fine (it already exists); only the i18n JSON needs D's ownership.

## 🚀 Definition of Done
- [ ] D30.1 EmptyState adopted in 5 pages (Activities, Board, CustomFields, GitHub, MyTasks)
- [ ] D30.2 `outbox.*` i18n keys in `en.json` + `vi.json` (Vietnamese values)
- [ ] `npm run build` + i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts`/i18n conflicts (rebase if needed)
