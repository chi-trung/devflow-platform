# Prompt — Agent D (Frontend + Infra): Analytics Dashboard + Notification Center + i18n

> You are **Agent D** on the DevFlow sprint team. Full plan: `docs/sprint28/plan.md`. Read it first.
> **Branch:** `feat/frontend-sprint28-analytics-notifications` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** `npm run build` (tsc strict) green; **i18n parity** — every key you ADD must go to BOTH `frontend/src/i18n/en.json` and `vi.json` (a vitest test asserts leaf-key parity both directions). For the vi.json fill-in task you add **no keys at all** — translate values only.
> **Scope lock:** You own `DashboardPage.tsx`, `components/dashboard/*`, `NotificationsPanel.tsx`, `NotificationsPage.tsx`, `SettingsPage.tsx` (settings-link anchor only). `components/ui/*` belongs to Agent C — if you need a shared component there, coordinate via the team lead, don't create it. Shared `api.ts`/`types/api.ts` edits are additive only.

---

## Context

DevFlow frontend is React 19 + Vite + Tailwind v4 + react-router + react-i18next. Two areas for you:

1. **Dashboard analytics** — `TeamPerformancePanel.tsx` is already wired, but to the **project-level** endpoint `/workspaces/{wsId}/projects/{projectId}/reporting/cycle-lead-time` (checked). The **workspace-level** aggregate endpoint `GET /workspaces/{wsId}/reporting/team` (`getTeamReport` in `api.ts`) is **not surfaced anywhere on the Dashboard**. Dashboard today shows no workspace-level team metrics.
2. **Notification center** — `NotificationsPanel.tsx` has tabs `all / unread / read` (a `NotificationFilter` type). Mention notifications exist: type string is `"Mention"` (created in `CreateCommentCommandHandler.cs` when a user types `@username`). **The backend `GET /notifications` has NO type filter** — `GetForUserAsync` takes only `userId`/`take`. So the Mentions tab is a **client-side filter** on `n.type.toLowerCase() === "mention"` — do NOT add backend params.

---

## Task D28.1 — Workspace-level analytics dashboard tiles

### Files
`frontend/src/pages/DashboardPage.tsx`, `frontend/src/components/dashboard/TeamPerformancePanel.tsx` (extend or add sibling), `frontend/src/lib/api.ts`, `frontend/src/types/api.ts`, i18n files.

### Approach
- Wire the workspace-level **Team Report** data into the Dashboard. `getTeamReport(workspaceId)` returns `TeamReportResponse` (members with stats, totals, and a `Trends` field) from `/workspaces/{wsId}/reporting/team`. Add tiles/cards for:
  - **Velocity / completed trend** — use `Trends.CompletedDelta` (diff vs previous period; green up / red down).
  - **Per-member task load** — a compact list from `Members` (name, completed, in-progress, minutes logged). Reuse existing `Skeleton` loading + `ErrorAlert` error patterns used elsewhere on the Dashboard.
- Extend `TeamPerformancePanel` (or add a sibling `TeamReportPanel`) to also render the workspace-level data, OR add a dedicated section on `DashboardPage`. Pick whichever keeps `DashboardPage` readable. If you reuse `TeamPerformancePanel`, keep its project-level API intact (it's consumed elsewhere — check usages before changing props).
- Add a **"View reports"** link from the Dashboard to the project-level ReportsPage (check the existing route name for ReportsPage — likely `/workspaces/:workspaceId/reports` or per-project).
- Add a **Sprint health card**: fetch current sprint + `getBurndown`/`getVelocity` if the Dashboard doesn't already render them; show burndown progress + velocity when an active sprint exists, an `EmptyState` when none. (Reuse `EmptyState` if Agent C has merged it; otherwise the existing dashed-border pattern — do NOT block on C.)
- Type the new fields in `types/api.ts` against the backend response (additive only).

### Acceptance criteria
- Dashboard shows workspace-level team metrics (completed delta, per-member load, minutes logged) from the existing `/reporting/team` API.
- Sprint health card renders when a sprint is active; empty state when none.
- "View reports" link navigates to the reports page.
- `npm run build` green; i18n parity green.

---

## Task D28.2 — Notification mention filter + settings link + vi.json fill-in

### Files
`frontend/src/components/notifications/NotificationsPanel.tsx`, `frontend/src/pages/NotificationsPage.tsx`, `frontend/src/i18n/vi.json`, `frontend/src/pages/SettingsPage.tsx` (add `id` anchor only), i18n.

### Part A — Mentions tab
- Add a **"Mentions"** tab to the existing tab list in `NotificationsPanel.tsx` (`["all", "unread", "read"]` → `["all", "unread", "read", "mentions"]`). Extend the `NotificationFilter` type in `types/api.ts` (additive) or a local union.
- Filter client-side: `if (filter === "mentions") return notifications.filter((n) => n.type.toLowerCase() === "mention");` — the backend has no type param (verified). Apply the same in `NotificationsPage.tsx`.
- i18n keys for the tab label in both `en.json` and `vi.json`.

### Part B — Notification settings deep-link
- Add a **gear/settings link** in the `NotificationsPanel` header and on `NotificationsPage`, linking to `/settings#notifications`.
- In `SettingsPage.tsx`, add `id="notifications"` (or an `id` matching the anchor) on the notification-preferences section **only** — do not restructure SettingsPage. If the router doesn't auto-scroll to hash anchors on mount, add a tiny `useEffect` that reads `location.hash` and `scrollIntoView`s the element (check existing routing behavior first).

### Part C — vi.json fill-in
- The `savedSearch` and `commandPalette` sections in `frontend/src/i18n/vi.json` are currently English placeholders. Translate the **values** to natural Vietnamese. **Do NOT add or remove any keys** — the i18n parity test enforces leaf-key parity both directions, and B/C may be adding keys concurrently (additive merge; if you see a conflict on those sections, reconcile with the merged state, still key-for-key).

### Acceptance criteria
- "Mentions" tab filters to mention-type notifications (client-side).
- Notification settings link navigates to `/settings` and scrolls to the prefs section.
- `vi.json` `savedSearch` + `commandPalette` values are in Vietnamese, key-for-key unchanged.
- `npm run build` green; i18n parity green.

---

## Notes
- Coordinate with Agent C: both of you touch `api.ts`/`types/api.ts` additively and both touch i18n files. **`components/ui/*` is C's — if their `EmptyState`/`Dialog` aren't merged yet, use the existing pattern and note the dependency in your PR body.**
- If `getBurndown`/`getVelocity` already exist in `api.ts` from an earlier sprint, reuse them; only add if missing.
- Open ONE PR containing both tasks when green; ping the team lead for review.
