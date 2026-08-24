# Prompt — Agent C (Frontend): Project Settings UI + Search UX + Component Library

> You are **Agent C** on the DevFlow sprint team. Full plan: `docs/sprint28/plan.md`. Read it first.
> **Branch:** `feat/frontend-sprint28-project-search` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** `npm run build` (tsc strict) green; **i18n parity** — every new key added to BOTH `frontend/src/i18n/en.json` and `vi.json` (a vitest test asserts leaf-key parity both directions).
> **Scope lock:** You own `SearchPage.tsx`, `WorkspacePage.tsx`, `CommandPalette.tsx`, `components/projects/*`, `components/ui/*`. **Do NOT edit `SettingsPage.tsx`** (Agent D owns it). Shared `api.ts`/`types/api.ts` edits are additive only.

---

## Context

DevFlow frontend is React 19 + Vite + Tailwind v4 + react-router + react-i18next. Backend for Sprint 28 (Agent B, B28.2) is adding `sortBy`/`sortDir` to search and a custom-field search group — type against the new shape additively, note the dependency in your PR body if it's not merged yet. Backend `UpdateProject` endpoint already exists: `PATCH /workspaces/{wsId}/projects/{projectId}` with body `{ name, description }` (`src/DevFlow.Api/Controllers/ProjectsController.cs:72`). **`updateProject` is NOT yet in `frontend/src/lib/api.ts` — you must add it.**

---

## Task C28.1 — Project settings/edit UI + reusable Dialog/Modal + EmptyState

### Files
`frontend/src/pages/WorkspacePage.tsx`, `frontend/src/components/ui/Dialog.tsx` (new), `frontend/src/components/ui/EmptyState.tsx` (new), `frontend/src/lib/api.ts` (`updateProject`), `frontend/src/types/api.ts`, `frontend/src/components/ConfirmDialog.tsx` (migrate to Dialog), i18n files.

### Part A — Reusable `Dialog` + `EmptyState` components
- **`Dialog`** in `frontend/src/components/ui/`: portal + overlay + close-on-Escape + close-on-outside-click + focus the dialog on open + `aria-modal`. API: `open`, `onClose`, `title`, `children`, optional `footer`. Migrate `ConfirmDialog.tsx` to use it (keep its API stable — `open`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `danger`). Migrate at least one more hand-rolled modal (pick the simplest: `NotificationsPanel.tsx` or the create-project modal in `WorkspacePage`).
- **`EmptyState`** in `frontend/src/components/ui/`: `icon` (ReactNode), `title`, `description`, optional `action` (ReactNode). Replace the copy-pasted dashed-border empty states in ≥3 of: SearchPage, DashboardPage, WorkspacePage, SavedSearchesPage, NotificationsPage.

### Part B — Project edit UI
- Add `updateProject(workspaceId, projectId, { name, description })` to `api.ts` (PATCH). Type `UpdateProjectInput` in `types/api.ts` if needed.
- In `WorkspacePage.tsx` project cards (Admin/Owner-gated, same gate as archive/restore): add an **Edit** button that opens a `Dialog` with name + description fields, prefilled. Save calls `updateProject` then refreshes the list. i18n keys for the dialog (`workspace.editProject`, `workspace.projectName`, `workspace.projectDescription`, `workspace.save`, `workspace.saving`, `workspace.editFailed`, `workspace.updatedNamed`).

### Acceptance criteria
- `Dialog` renders overlay + content, closes on Escape/outside-click, focuses on open.
- `EmptyState` replaces dashed-border patterns in ≥3 pages.
- Project edit dialog saves name/description via API; list refreshes without full reload.
- `npm run build` green; i18n parity green.

---

## Task C28.2 — Search filter parity + sort controls + apply-saved-search

### Files
`frontend/src/pages/SearchPage.tsx`, `frontend/src/components/CommandPalette.tsx`, `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n files.

### Approach
- Surface the missing filters in `SearchPage.tsx` alongside the existing status + priority: **assignee** (dropdown from workspace members — reuse the members API `getWorkspaceMembers`), **label** (dropdown from project labels), **due before / due after** (date inputs). The `SearchFilters` type already supports these (`api.ts:404-411`).
- Add **sort controls**: `sortBy` dropdown (createdAt/updatedAt/title/status/priority/dueDate) + `sortDir` toggle (asc/desc). Forward to `searchWorkspace` (extend its signature with `sortBy`/`sortDir` params — additive).
- Add an **"Apply saved search"** dropdown on SearchPage: load via `getSavedSearches`, pick one, fill its filters, run the search. (Saved searches live in `CommandPalette.tsx` + `SavedSearchesPage.tsx` today; surface them on the search page too.)
- Keep the tab layout and load-more from Sprint 27. i18n keys for new filter labels + sort options + apply-saved-search in both files.

### Acceptance criteria
- All backend-supported filters (assignee/label/due) are surfaced in the UI.
- Sort controls change result ordering (consuming B28.2 backend params).
- Saved searches can be applied from the search page.
- `npm run build` green; i18n parity green.

---

## Notes
- Coordinate with Agent D: both of you touch `api.ts`/`types/api.ts` additively. **`SettingsPage.tsx` is D's — don't touch it.** The `ui/` folder is yours — if D needs a shared component there, they'll coordinate via the plan.
- If the B28.2 backend (sort + custom-field group) isn't merged yet, type against the new response shape anyway and note the dependency in your PR body.
- Open ONE PR containing both tasks when green; ping the team lead for review.
