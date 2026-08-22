# AGENT STATUS — Sprint 16 PLAN 🚀

> Split 50/50: Codebuff (backend) ↔ OpenCode (frontend).
> Contract-first: API shapes below are FROZEN at plan time. If an agent must change
> a contract, update this file FIRST and note it under "Contract changes" before coding.
> Every PR auto-merges once CI passes (workflow from PR #70).

## 🎯 Sprint 16 — Personalization & Workflow Polish

Four feature PAIRS. Suggested landing order: P1 → P2 → P3 → P4, but pairs are
independent — both agents can work their queue in parallel without waiting,
as long as the frontend item only *wires* its backend counterpart after that
backend PR merges (build UI/components immediately using the frozen contract).

| Pair | Backend (Codebuff) | Frontend (OpenCode) |
|------|--------------------|---------------------|
| P1 | B1 Notification preferences | F1 Settings toggles |
| P2 | B2 Webhook test-fire | F2 "Send test" button |
| P3 | B3 Task ordering | F3 Drag-reorder persistence |
| P4 | B4 Saved searches | F4 Palette save/search chips |

---

## Agent: Codebuff (Backend) — scope `src/`, branches `feat/backend-sprint16-*`

### B1: Notification preferences API (P1 — unblocks OpenCode's blocked F-item)
- [ ] `GET /api/v1/users/me/notification-preferences`
      → `{ "emailOnAssignment": true, "emailOnMention": true, "emailOnSprintStarted": false }`
- [ ] `PUT /api/v1/users/me/notification-preferences` (full-body replace, same shape)
- [ ] Persistence: per-user (new `NotificationPreferences` entity or JSON column on User + EF migration)
- [ ] Honor prefs in ResendEmailService dispatch points (skip email when toggle off)

### B2: Webhook test-fire endpoint (P2)
- [ ] `POST /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}/test`
- [ ] Sends sample `task.created` payload, HMAC-signed with the webhook's secret
- [ ] Response: `{ "delivered": false, "statusCode": 0, "latencyMs": 0, "error": null }`
      (`delivered=true`, real `statusCode` on success; `error` string on failure)

### B3: Task manual ordering (P3)
- [ ] Add `Position` (int) to TaskItem + EF migration (default = current id-based order)
- [ ] `PUT /api/v1/workspaces/{wsId}/projects/{projId}/tasks/reorder`
      body: `{ "tasks": [ { "id": "<guid>", "status": "InProgress", "position": 0 }, … ] }`
      → `204 No Content`; updates status AND position in one transaction (drag-drop drops across columns included)

### B4: Saved searches (P4)
- [ ] `GET /api/v1/users/me/saved-searches` → array of SavedSearchResponse
- [ ] `POST /api/v1/users/me/saved-searches` body:
      `{ "name": "My urgent bugs", "workspaceId": "<guid>", "query": "", "filters": { "status": null, "priority": "Critical", "assigneeId": null, "labelId": null, "dueBefore": null, "dueAfter": null } }`
      → `{ "id": "<guid>", … , "createdAt": "<iso>" }`
- [ ] `DELETE /api/v1/users/me/saved-searches/{id}` → 204
- [ ] Scoped per user + workspace; max ~20 per user (400 beyond)

---

## Agent: OpenCode (Frontend) — scope `frontend/src/`, branches `feat/frontend-sprint16-*`

### F1: Notification/email preferences toggles (P1, needs B1) ✅ UI SHIPPED
- [x] SettingsPage: 3 switches bound to GET/PUT preferences — optimistic update, rollback on error
- [x] Graceful degradation: API 404 → falls back to legacy local-only toggles; card auto-upgrades when B1 merges

### F2: Webhook "Send test" action (P2, needs B2) ✅ UI SHIPPED
- [x] Per-row Send button → shows delivered ✓/✗, HTTP status, latency
- [x] 404 → "Test endpoint isn't available yet." toast until B2 merges

### F3: Drag-reorder persistence (P3, needs B3) ✅ UI SHIPPED
- [x] Column-level insert indicators; drop above/below any card or at column end
- [x] moveTask: optimistic resequence + PUT /tasks/reorder; PATCH fallback keeps cross-column moves working pre-B3
- [x] Columns sort by position ?? createdAtUtc

### F4: Saved searches in CommandPalette (P4, needs B4) ✅ UI SHIPPED
- [x] Chips row (click = apply filters, hover × = delete); "Save this search…" inline name input when filters active
- [x] Silently no-ops until B4 ships

### Carried over from Sprint 15
- [ ] Email notification preferences toggle — superseded by F1 ✅ planned
- [ ] Bugs "board empty columns" / "workspace blank": NOT reproduced after code review;
      need repro steps (URL + role + network tab) from whoever saw them before reopening

---

## Contract changes log
| Date | Who | Change |
|------|-----|--------|
| 2026-08-22 | OpenCode | Initial Sprint 16 contracts frozen |

---

## Project Metrics

| Metric | Value |
|--------|-------|
| Sprints | 15 shipped, 16 planned |
| Backend features | 20+ APIs |
| Frontend features | i18n, PWA, code splitting, realtime notifications, webhooks UI, import UI, filtered palette |
| Tests | 65/65 pass ✅ |
| Email service | Resend (active) |
| CI | Auto-merge on green (PR #70) ✅ |
| Deploy | Vercel (FE) + Render (BE) |

---

*Last updated: 2026-08-22 — OpenCode: F1-F4 frontend shipped (graceful degradation until B1-B4 land); Codebuff: B1-B4 backend still open*
