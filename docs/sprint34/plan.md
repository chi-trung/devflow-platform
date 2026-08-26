# 🚀 Sprint 34 — Board Swimlanes (Landing-Parity D)

> **Plan ref:** `wise-prancing-ritchie.md` — Sprint D, "PR 4 — Sprint D" (swimlanes).
> **Status:** Complete ✅
> **PR:** #188 (D1, frontend-only).
> **Branch:** `feat/landing-parity-sprint-d`

## Goal

Close the landing ↔ app gap for the **swimlanes** claim. The kanban board
previously rendered a flat task list in each column; this sprint adds optional
grouping of tasks within each column by **assignee** or **epic**, with vertical
lane headers and per-lane counts.

## Scope

**Frontend-only.** `TaskItemResponse` on the backend already returns
`AssigneeId` and `EpicId` on every task, so no entity / migration / endpoint
work is required. Tasks are grouped client-side from the tasks already loaded
for the board.

## D1 — Swimlane toggle + grouping

- **`frontend/src/types/api.ts`** — expose `epicId: string | null` on
  `TaskItemResponse` (was missing on the frontend type even though the backend
  returns it). This is a required field, so the two literals that construct a
  `TaskItemResponse` were updated:
  - `GraphModal.tsx` — synthetic task for dependency-graph nodes → `epicId: null`.
  - `BoardPage.tsx` — optimistic task in `createTask` → `epicId: null`.
- **`frontend/src/components/board/Column.tsx`** —
  - New props `epics?: EpicResponse[]` and `swimlaneMode?: "none" | "assignee" | "epic"`.
  - When `swimlaneMode !== "none"`, partition the **windowed** task list into a
    `Map<string, TaskItemResponse[]>` keyed by `assigneeId` / `epicId`
    (falling back to the reserved keys `"unassigned"` / `"no-epic"`).
  - Resolve lane labels from `members` (displayName → username) or `epics` (name),
    falling back to the raw id. Lane labels are sorted with
    `String.localeCompare`; the fallback lanes always sort **last** so the
    layout stays stable across filters.
  - Render one lane header (label + count) per group, with the cards indented
    underneath. Windowed rendering, drag-and-drop `beforeTaskId` resolution,
    selection and "show more" all keep working inside lanes.
- **`frontend/src/pages/BoardPage.tsx`** —
  - `swimlaneMode` state (`"none" | "assignee" | "epic"`, default `"none"`).
  - Fetch epics via the existing `getEpics` API and pass `epics` + `swimlaneMode`
    into each `Column`.
  - Swimlane `<select>` in the board toolbar (labels from i18n).
- **i18n (en + vi, parity 100%)** — `board.swimlane`, `board.swimlaneGroupBy`,
  `board.swimlaneNone`, `board.swimlaneByAssignee`, `board.swimlaneByEpic`,
  `board.swimlaneUnassigned`, `board.swimlaneNoEpic`.

## Verification

- [x] `npm run build` (tsc strict) — green.
- [x] `npm test` — 30/30 (incl. i18n parity test).
- [x] Squash-merged via PR #188.
