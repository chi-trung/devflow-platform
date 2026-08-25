# 🚀 Sprint 31 — Agent D (Frontend + i18n): EmptyState Sweep + Epic Dependency UI + i18n

**Role:** Frontend Developer (React 19 + TypeScript + Tailwind + i18n) — you own the i18n key space.
**Branch:** `feat/frontend-sprint31-epic-emptystate` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `npm run build` (tsc strict) green; i18n parity green. Shared-file ownership: `api.ts`/`types/api.ts` (coordinate with C — both of you add functions), `i18n/*.json` (YOU own all keys — C references your `outbox.*` batch keys but does NOT add them).

---

## Your scope: 2 tasks

### D31.1 — EmptyState adoption (remaining ~20 files)

Sprint 30 (D30.1) adopted `<EmptyState>` in 5 pages. **22 files still hand-roll `border-dashed` empty states.** Convert them to the shared component.

**Files** (pages first, then shared components):
- Pages: `DashboardPage.tsx`, `EpicsPage.tsx`, `LabelsPage.tsx`, `SprintPlanningPage.tsx`, `TemplatesPage.tsx`, `WorkspacePage.tsx`, `WebhooksPage.tsx` (the non-DLQ empty state ~line 288), `BoardPage.tsx` (any remaining).
- Components: `SprintHealthCard.tsx`, `CumulativeFlow.tsx`, `TeamPerformancePanel.tsx`, `BurndownChartApi.tsx`, `CycleLeadTimeChart.tsx`, `TeamReportCards.tsx`, `VelocityChart.tsx`, `VelocityTrendChart.tsx`, `BurndownChart.tsx`, `EpicRoadmap.tsx`, `SprintBoard.tsx`, `Column.tsx`, `ImportTasksModal.tsx`, `ExportImportModal.tsx`.

**Rules:**
- Import `EmptyState` from `../../components/ui/EmptyState` (adjust relative path per file).
- Preserve icon / i18n keys / action buttons EXACTLY — only the wrapper markup changes (same dashed look, same spacing, no visual regression).
- **Skip** empty states that are NOT semantically "empty list": `Column.tsx` drop-target, `EpicRoadmap` today-line — those are layout, not empty-state.
- Do NOT touch `EmptyState.tsx` itself.

**Acceptance:** `npm run build` green; no visual regression.

---

### D31.2 — Epic dependency UI + i18n (incl. outbox batch keys for C)

**Files:** `frontend/src/pages/EpicsPage.tsx`, `frontend/src/components/epic/EpicRoadmap.tsx` (optional), `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, `frontend/src/i18n/en.json` + `vi.json`

Agent B ships the epic-dependency backend (B31.2). Build the UI:

**API client additions (api.ts):**
```ts
export function getEpicDependencies(workspaceId: string, projectId: string, epicId: string): Promise<EpicDependencyResponse[]>
export async function addEpicDependency(workspaceId: string, projectId: string, epicId: string, blockedByEpicId: string): Promise<void>
export async function removeEpicDependency(workspaceId: string, projectId: string, epicId: string, blockedByEpicId: string): Promise<void>
```

**Type (types/api.ts):**
```ts
export interface EpicDependencyResponse {
  epicId: string;        // dependent epic
  blockedByEpicId: string;
  blockedByTitle: string;
  blockedByStatus: string;
}
```

**UI on EpicsPage:**
- On the epic detail/modal: **"Blocked by"** section — list blocking epics (clickable, title + status badge), an add-blocker picker (epic dropdown excluding self + already-blocking), and remove (X) per row.
- Badge on epic cards when blocked (`blockedByEpicIds` from `EpicResponse`).
- Loading/error/empty states (`Plus` icon for empty).
- **i18n keys** (add to BOTH en.json + vi.json, translated):
  ```json
  "epic": {
    "blockedBy": "Blocked by",
    "addBlocker": "Add blocker",
    "removeBlocker": "Remove blocker",
    "noBlockers": "No blockers",
    "blockedBadge": "Blocked",
    "blockerAdded": "Blocker added",
    "blockerRemoved": "Blocker removed"
  }
  ```

**i18n keys for C31.2's DLQ batch buttons** — YOU add these to the existing `outbox` section (BOTH en + vi). C references them via `t("outbox.*")`:
```json
"outbox": {
  "replayAll": "Replay all",
  "replayAllSuccess": "Re-queued {count} message(s)",
  "replayAllFailed": "Failed to re-queue messages",
  "purge": "Purge",
  "purgeConfirm": "Delete ALL dead-lettered messages? This cannot be undone.",
  "purgeSuccess": "Dead-letter queue purged",
  "purgeFailed": "Failed to purge dead-letter queue"
}
```

**Acceptance:** `npm run build` + i18n parity green.

---

## ⚠️ Coordination notes

- **`api.ts` / `types/api.ts`** — shared with Agent C. C adds project-member + DLQ-batch fns. You add epic-dep fns. Coordinate merge order (rebase if the other's PR lands first); do NOT delete each other's additions.
- **`i18n/*.json`** — YOU own ALL keys. C adds `projectMember.*` keys for its OWN component (ok), but does NOT add `outbox.*` batch keys — those are yours (D31.2). Reference the `outbox.*` keys you own.
- **`EpicsPage.tsx`** — you also convert its empty state in D31.1; do the epic-dep UI in the same pass to avoid editing the file twice.
- **`EpicResponse.blockedByEpicIds`** — additive backend field (B31.2). Frontend treats unknown/missing fields tolerantly; you may need to `?? []` when reading it.

## 🚀 Definition of Done
- [ ] D31.1 EmptyState adopted in all listed files (except layout-only), build green
- [ ] D31.2 Epic "Blocked by" UI + badge + epic-dep api/types
- [ ] `outbox.*` batch i18n keys (en + vi) for C31.2
- [ ] `npm run build` + i18n parity green
- [ ] PR targets `main`, conventional commits, no `api.ts`/`types/api.ts`/i18n conflicts (rebase if needed)