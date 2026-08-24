# Prompt — Agent C (Frontend): Search UI + Archive/Restore UX

> You are **Agent C** on the DevFlow sprint team. Full plan: `docs/sprint27/plan.md`. Read it first.
> **Branch:** `feat/frontend-sprint27-search-restore` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** `npm run build` (tsc strict) green; **i18n parity** — every new key added to BOTH `frontend/src/i18n/en.json` and `vi.json` (a vitest test asserts leaf-key parity both directions, so missing one breaks CI).
> **Scope lock:** You own `SearchPage.tsx`, `WorkspacePage.tsx`, `components/projects/*`, `CommandPalette.tsx`. **Do NOT edit `SettingsPage.tsx`** (Agent D owns it). Shared `api.ts`/`types/api.ts` edits are yours but keep them additive and coordinate via the plan.

---

## Context

DevFlow frontend is React 19 + Vite + Tailwind v4 + react-router + react-i18next, talking to the .NET API at `/api/v1`. Two gaps this sprint:

1. **Search backend is being rewritten (Agent A, A27.1)** from in-memory LINQ to DB-level `ILIKE` with **pagination metadata**. The API response will gain per-group `total` / `page` / `pageSize`. Your job: consume it.
2. **Archive/restore UX missing** — backend `POST /api/v1/workspaces/{wsId}/projects/{projectId}/restore` already exists (Sprint 26, B26.2), and the project list returns archived projects, but the UI has **zero restore affordance** — archived projects can't be restored by users.

---

## Task C27.1 — Paginated search UI

### Files
`frontend/src/pages/SearchPage.tsx`, `frontend/src/components/CommandPalette.tsx`, `frontend/src/lib/api.ts` (`searchWorkspace`), `frontend/src/types/api.ts` (`SearchResponse`), `frontend/src/i18n/en.json` + `vi.json`.

### Approach
- After Agent A's A27.1 lands, `SearchResponse` carries per-group totals. Add **result counts** ("N results") per active tab and a **"Load more" / next-page control** that re-queries with `page+1` and appends (or replaces — keep it simple and consistent).
- `searchWorkspace` must accept and forward `page`/`pageSize` params.
- Keep the existing tab layout (tasks/projects/epics/labels/users/comments) and filters.
- i18n keys in **both** files.

### Acceptance criteria
- Each tab shows its result total; paging control works (`/search?page=2` semantics).
- `npm run build` green; i18n parity test green.

---

## Task C27.2 — Archived-project list + Restore UI

### Files
`frontend/src/pages/WorkspacePage.tsx`, project-card component(s) under `frontend/src/components/projects/`, `frontend/src/lib/api.ts` (`restoreProject`), `frontend/src/types/api.ts`, i18n files.

### Approach
- Add `restoreProject(workspaceId, projectId)` to `api.ts` (POST to the existing backend restore endpoint; check the exact route in `ProjectsController.cs`).
- In the workspace project list, archived projects already appear (the backend returns all statuses). Give archived project cards: an "Archived" status badge + a **Restore** action (Admin-gated — same gate as the existing archive affordance, `workspace.role === "Owner" || "Admin"`).
- Restore calls the API then refreshes the list; the card returns to Active.
- Empty-state text for "no archived projects" in both i18n files.

### Acceptance criteria
- Archived project cards show status + Restore button (visible only to Owner/Admin).
- Restore flips the project back to Active in the list without a full reload hack.
- `npm run build` green; i18n parity green.

---

## Notes
- Coordinate with Agent D: both of you touch `api.ts`/`types/api.ts` additively. **`SettingsPage.tsx` is D's — don't touch it.**
- If the search backend PR (A27.1) hasn't merged yet, build against the new response shape anyway (type first), and note the dependency in your PR body.
- Open ONE PR containing both tasks when green; ping the team lead for review.
