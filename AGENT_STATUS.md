# 🚀 AGENT STATUS & BIG UPDATE ROADMAP — DevFlow 2.0

> **Current Milestone:** DevFlow 2.0 Enterprise & Performance Evolution  
> **Status:** Sprint 17 Complete ✅ | Sprint 18 Complete ✅ | Sprint 19 Complete ✅ | Sprint 20 Complete ✅ | Sprint 21 Complete ✅ | Sprint 22 Complete ✅ | Sprint 23 Complete ✅ | Sprint 24 Complete ✅ | Sprint 25 Complete ✅ | **Sprint 26 Complete ✅** | **Sprint 27 Complete ✅** | **Sprint 28 Complete ✅** | **Sprint 29 Complete ✅** | **Sprint 30 Complete ✅** | **Sprint 31 Complete ✅** | **Sprint 32 Planning 🚧**

---

| Sprint | Focus Area | Backend (Codebuff) | Frontend (OpenCode) | Status |
|---|---|---|---|---|
| **Sprint 16** | Personalization & Workflows | ✅ DONE (B1-B4) | ✅ DONE (F1-F4) | Complete |
| **Sprint 17** | Performance Hardening & State Sync | ✅ DONE (B17.1-B17.4) | ✅ DONE (F17.1-F17.4) | Complete |
| **Sprint 18** | Epics, Subtasks & Task Hierarchy | ✅ DONE (B18.1-B18.3) — PR #77 | ✅ DONE (F18.1-F18.3) — PR #89-91 | Complete |
| **Sprint 19** | GitHub Integration & Webhook Outbox | ✅ DONE (B19.1-B19.3) — PR #93 | ✅ DONE (F19.1-F19.3) — PR #92 | Complete ✅ |
| **Sprint 20** | Advanced Agile Analytics & Custom Fields | ✅ DONE (B20.1-3) — PR #94, #95 | ✅ DONE (F20.1-3) — PR #94 | Complete ✅ |
| **Sprint 21** | Live Team Experience (Notifications + My Work + Dashboard) | ✅ DONE (B21.1-3) — PR #98 | ✅ DONE (F21.1-2) — PR #96, (A21.1-2) — PR #97 | Complete ✅ |
| **Sprint 22** | Observability & Collaboration Depth (Activity Log + Notifications + UI Depth + Search) | ✅ DONE (B22.1-3) — PR #100 | ✅ DONE (C22.1-3) — PR #101, A22.1-2 (Agent A), D22.1-2 (Agent D) — PR #102 | Complete ✅ |
| **Sprint 23** | Performance & UX Evolution (SWR cache + code-splitting + optimistic UX) | ✅ Backend verified already optimized | ✅ DONE (A23.1) SWR cache + prefetch + vendor chunks — PR #103; (A23.2) optimistic task create + preconnect — PR #104 | Complete ✅ |
| **Sprint 24** | Real Caching, Google OAuth, Live Presence, Import/Export | ✅ DONE (B24.1) real Redis cache wiring — PR #105; (A24.1) Google OAuth PKCE — PR #107 | ✅ DONE (C24.1-4) presence avatars + inline child task + skeleton + tab title — PR #108; (D24.1-2) import/export + search — PR #106 | Complete ✅ |
| **Sprint 25** | Guardrails & Collaboration Depth (RBAC + Presence + Watchers + Activity) | ✅ DONE (A25.1) RBAC hardening — PR #109; (B25.1-2) presence broadcast + task watchers — PR #110, #111 | ✅ DONE (C25.1-2) presence fix + role-aware UI — PR #112; (D25.1-2) activity transparency — PR #110 | Complete ✅ |
| **Sprint 26** | Performance & Data Integrity Hardening (Dashboard perf + Outbox DLQ + Soft-delete + Watchers UI + FE tests + CI safety) | ✅ Agent A: A26.1 Dashboard rewrite, A26.2 Outbox DLQ, A26.3 Sprint delete, A26.4 review/merge; Agent B: B26.1 unified notification prefs, B26.2 soft-delete + restore | ✅ Agent C: C26.1 task watcher UI, C26.2 dashboard actor names + empty states; Agent D: D26.1 Vitest + FE tests, D26.2 CI safety | Complete ✅ |
| **Sprint 27** | Search & Event Coverage (DB-level search + pagination + Email 4 events + Restore UI + Prefs UI + DB backup) | ✅ Agent A: A27.1 global search rewrite — PR #121, A27.2 review/merge; Agent B: B27.1 email templates+toggles, B27.2 unit tests — PR #122 | ✅ Agent C: C27.1 paginated search UI, C27.2 archived-project list + Restore UI — PR #123; Agent D: D27.1 prefs settings UI, D27.2 DB backup automation — PR #120 | Complete ✅ |
| **Sprint 28** | Webhook Reliability & Project Mgmt UX (DLQ fix + admin retry + test coverage + reporting/search polish + project settings UI + analytics tiles + notification mentions) | ✅ Agent A: A28.1 webhook DLQ fix + admin retry endpoint — PR #124; A28.2 review/merge — PRs #125, #127, #128, #129, #130; Agent B: B28.1 tests Bulk/Export/Import/Users, B28.2 reporting trends + search sort/custom-field — PR #125 | ✅ Agent C: C28.1 project settings UI + Dialog/EmptyState, C28.2 search filter parity + sort — PR #129; Agent D: D28.1 workspace analytics tiles, D28.2 mention filter + settings link + vi.json — PR #127 | Complete ✅ |
| **Sprint 29** | File Upload Safety & Settings Polish (upload size/type limits + workspace/sprint/template edit + bulk ops UX + attachment upload UX + vi.json completion + notification badge) | ✅ Agent A: A29.1 file upload size limit + type whitelist; A29.2 Workspace/Sprint/Template PUT endpoints; A29.3 review/merge; Agent B: B29.1 attachment pagination + cache headers, B29.2 notification batch-delete + unread-count, B29.3 tests | ✅ Agent C: C29.1 bulk ops UI (select-all + batch action bar), C29.2 attachment upload progress/error/retry; Agent D: D29.1 workspace/sprint/template edit UI, D29.2 vi.json 122 keys + AppShell badge | Complete ✅ |
| **Sprint 30** | Webhook Admin UI, Watcher List, Security Fixes & Polish (template scoping fix + README/docs + watchers query/UI + integration tests + DLQ admin UI + EmptyState adoption + outbox i18n) | ✅ Agent A: A30.1 template scoping fix — PR #145, A30.2 README/docs — PR #146, A30.3 review/merge — PRs #147, #148; Agent B: B30.1 GetTaskWatchersQuery + endpoint, B30.2 integration tests — PR #147 | ✅ Agent C: C30.1 watcher list UI, C30.2 DLQ admin UI; Agent D: D30.1 EmptyState adoption, D30.2 outbox i18n — PR #148 | Complete ✅ |
| **Sprint 31** | Project-Level RBAC, Outbox Admin Batch, EmptyState Sweep & Depth Polish (ProjectMember entity + CQRS + epic deps + project auth guard + member UI + DLQ batch + EmptyState sweep + epic deps UI + i18n) | ✅ A31.1 ProjectMember entity/migration/repo, A31.2 member CQRS endpoints, A31.3 review/merge — PR #150; B31.1 outbox replay-all/purge, B31.2 epic deps, B31.3 ProjectAuthorizationBehavior — PR #151 | ✅ C31.1 project member UI, C31.2 DLQ Replay-all/Purge buttons — PR #152; D31.1 EmptyState sweep (~20 files), D31.2 epic deps UI + i18n — PR #153 | Complete ✅ |

---

## ➕ Bonus: Task Dependencies Visual Graph (KILO) — MERGED ✅
Project-level dependency graph API + interactive GraphModal (drag-drop edges, search,
blockers/blocked-by toggle). Landed on main via PR #76.

---

## 🎯 Detailed Sprint Breakdown

### 📍 Sprint 16 — Personalization & Workflow Polish (Current)

#### 🤖 Agent: Codebuff (`src/`) — COMPLETED ✅
- [x] **B1: Notification Preferences API** (`GET/PUT /api/v1/users/me/notification-preferences`)
- [x] **B2: Webhook Test-Fire API** (`POST /api/v1/workspaces/{id}/webhooks/{id}/test`)
- [x] **B3: Task Manual Ordering** (`PUT /api/v1/workspaces/{wsId}/projects/{projId}/tasks/reorder`)
- [x] **B4: Saved Searches** (`GET/POST/DELETE /api/v1/users/me/saved-searches`)

#### 🎨 Agent: OpenCode (`frontend/src/`) — COMPLETED ✅
- [x] **F1: Settings Notification Toggles** — Connected to Notification Preferences API (3 server-backed toggles, master switch, optimistic save w/ rollback).
- [x] **F2: Webhook "Send Test" Button** — Per-webhook Zap button + result modal (delivered ✓/✗, HTTP status, latency ms, error).
- [x] **F3: Drag-Reorder Persistence** — Index-aware column drops; moves persist via `tasks/reorder` (status + position per affected column).
- [x] **F4: Command Palette Saved Searches** — Save current query/filters to API, run from palette via `?fs=` handoff to BoardPage, inline delete.

> **✅ B16.5 (done by OpenCode, hotfix):**
> `GET .../tasks` now orders by `Position` (tiebreak `CreatedAtUtc DESC`) and
> `TaskItemResponse` exposes `position`. Also added missing `[Authorize]` to
> NotificationPreferences / SavedSearches / Webhooks controllers (were public!).

---

### ⚡ Sprint 17 — Performance, Stability & Cache Hardening (Big Update Core)

**Goal:** Eliminate all Render cold start delays, rate-limit bottlenecks, and optimize query latency to sub-50ms.

#### 🤖 Agent: Codebuff (Backend)
- [x] **B17.1: Redis Output & Query Caching**
  - Cache workspace metadata, member lists, and active sprint snapshots with automated cache tag invalidation.
- [x] **B17.2: Sliding-Window Rate Limiting & Tiering**
  - Upgrade rate limiter to sliding window per user token / authenticated identity (with higher quota for active UI sessions).
- [x] **B17.3: Outbox Pattern & Background Workers**
  - Implement reliable background worker for notifications and webhooks with exponential backoff retries.
- [x] **B17.4: Health Check & Keepalive Endpoint Optimization**
  - Dedicated lightweight probe `/api/v1/ping` with database keepalive query for zero-cold-start hosting.

#### 🎨 Agent: OpenCode (Frontend)
- [x] **F17.1: Global Request Deduplication & Stale-While-Revalidate Caching**
  - 5s TTL cache + in-flight dedup in `api()`; mutations now invalidate the whole GET cache; `invalidateApiCache()` exported and wired into logout.
- [x] **F17.2: SignalR Auto-Reconnection & Resilience Guard**
  - Backoff `[0,2,5,10,30,60s]`; **auto re-join project group on reconnect** (`createProjectConnection(projectId)`); `onConnectionWake` listener restarts hub + refetches when connectivity returns; notification stream auto-restarts on `online`.
- [x] **F17.3: Windowed Board Columns**
  - Columns render 12 cards then stream +12 via IntersectionObserver sentinel / "Show more" button; page size raised 8→24. DOM stays small on 500+ task projects.
- [x] **F17.4: Keepalive & Warm-up Indicator**
  - `lib/keepalive.ts` pings `/health` every 4 min while tab open (visibility-aware); `ApiStatusDot` in AppShell sidebar + mobile header (green=warm / amber pulsing=waking / red=offline).

---

### 🌲 Sprint 18 — Epics, Subtasks & Hierarchy

**Goal:** Transform tasks into full hierarchical project trees (Epic $\rightarrow$ Task $\rightarrow$ Subtask).

#### 🤖 Agent: Codebuff (Backend) — COMPLETED ✅ (ox-alpha, PR #77)
- [x] **B18.1: Epic Entity & API**
  - `GET/POST/PUT/DELETE /api/v1/workspaces/{wsId}/projects/{projId}/epics`
  - Epic progress computation (% completed tasks, story point totals).
- [x] **B18.2: Subtask System**
  - Parent-child task relationship (one level deep), subtask inherits parent sprint/epic.
  - Cascading state rule: closing the last open subtask auto-closes the parent.
- [x] **B18.3: Story Points & Estimation**
  - `PUT .../tasks/{taskId}/estimation` (Fibonacci {1,2,3,5,8,13,21} or null).
  - `GET .../sprints/{sprintId}/velocity` aggregation endpoint.
- Migration: `AddSprint18EpicsSubtasksStoryPoints` (all-nullable columns, symmetric rollback).
- Tests: 89 unit (+24 new) + 1 integration — green.

#### 🎨 Agent: OpenCode (Frontend)
- [x] **F18.2: Subtask Checklist Component** — ✅ **Agent A**
  - `frontend/src/components/board/SubtaskSection.tsx` wired into `TaskDetailPanel.tsx`.
  - List subtasks (`GET .../tasks/{parentId}/subtasks` → `TaskItemResponse[]`), create (`POST` `CreateSubtaskRequest{Title,Description,Priority}`), detach (`DELETE .../subtasks/{subtaskId}`), toggle completion (PATCH subtask status Done/Backlog), progress bar, nested subtask count on TaskCard.
- [x] **F18.1: Epic Roadmap & Timeline View** — ✅ **Agent C**
  - Gantt/Roadmap timeline view in `EpicsPage.tsx` (List/Roadmap toggle) + `frontend/src/components/epic/EpicRoadmap.tsx`.
  - Month tick header, today line, progress-filled Gantt bars from `EpicResponse` (`startDateUtc`/`endDateUtc`/`completionPercent`), milestone markers for date-less epics, unscheduled chips, click-to-edit.
- [x] **F18.3: Story Point Badges & Board Estimator** — ✅ **Agent B**
  - Fibonacci story point badge on TaskCard + edit modal (`PUT .../tasks/{id}/estimation`, values {1,2,3,5,8,13,21}), column totals, sprint capacity meter via `GET .../sprints/{id}/velocity` (`SprintVelocityResponse`).

---

### 🐙 Sprint 19 — GitHub Integration & Webhook Delivery Engine

**Goal:** Turn DevFlow into the central source of truth for software engineers with automatic Git syncing.

#### 🤖 Agent: Codebuff (Backend) — ✅ COMPLETE (PR #93)
- [x] **B19.1: GitHub App Webhook Ingestion** — ✅ **Agent B**
  - `POST /api/v1/webhooks/github` handles `push`/`pull_request`/`issues`, HMAC-SHA256 signature verify (`X-Hub-Signature-256`), async processing.
  - `TaskKeyParser.ParseKeys()` regex `<PROJECT_KEY>-<number>` (dedup, case-insensitive).
- [x] **B19.2: Smart Task State Transitions** — ✅ **Agent B**
  - PR opened → task → **In Review**; PR merged → task → **Done** + activity log.
  - Fixed in review: `pull_request.merged` boolean + `action` (not non-existent state values); safe payload parsing.
- [x] **B19.3: Personal Access Tokens (PAT)** — ✅ **Agent C**
  - Entity, migration, repository, CQRS (Create/List/Revoke), PatController (`/users/me/pat`), 4 unit tests.
  - Token format `df_<48 hex>`, SHA256 hash, scopes (`read`/`write`/`tasks`/`admin`), expiration, revoke.

#### 🎨 Agent: OpenCode (Frontend) — ✅ COMPLETE (PR #92)
- [x] **F19.1: GitHub Integration Settings UI** — ✅ **Agent C**
  - Webhook secret management (PUT webhook-secret) + payload URL display, branch rule toggles (localStorage), PAT generator (calls backend API).
- [x] **F19.2: Git Branch & PR Widget in Task Detail** — ✅ **Agent C**
  - Branch derivation from PR URL/title, CI/CD placeholder (`CI: —`), direct GitHub link button, author display.
- [x] **F19.3: Personal Access Token Generator** — ✅ **Agent B**
  - Standalone `PATSection.tsx` in Settings page (create modal, one-time token copy, revoke list).
  - Fixed in review: scopes aligned to backend (`read`/`write`/`tasks`/`admin`), deduped render in SettingsPage.**

---

### 📈 Sprint 20 — Advanced Agile Analytics & Custom Fields

**Goal:** Enterprise analytics, customizable workflows, and comprehensive team insights.

> **Hiện trạng trước Sprint 20:** Custom Fields backend đã HOÀN CHỈNH (CRUD + SetValue + GetTaskValues — `CustomFieldsController`, `TaskCustomFieldValue` entity, `CustomFieldsPage.tsx` builder). Reporting backend đã có Burndown/Velocity/Team Report + charts. Story points đã có. → **Sprint 20 tập trung vào gap thật**: Cycle/Lead Time, Velocity history trend, Sprint Rollover, CFD, Team dashboard, Custom Field value render trên card.

#### 🤖 Agent: Codebuff (Backend) — Agent B & A
- [x] **B20.1: Cycle Time & Lead Time Analytics (Agent B)** ✅ — **PR #95 merged**
  - Thêm `StartedAtUtc` field cho TaskItem (track khi task vào InProgress) + migration.
  - `GET .../reporting/cycle-lead-time` — Cycle Time (InProgress→Done) & Lead Time (Created→Done), trả P50/P90 (interpolation) + per-task breakdown (last 100 done).
- [x] **B20.2: Velocity History Trend (Agent B)** ✅ — **PR #95 merged**
  - `GET .../reporting/velocity-history` — aggregate 10 sprints gần nhất (story points total/completed) + averages.
  - Tests: 140/140 green (14 new).
- [x] **B20.3: Sprint Rollover Automation (Agent A)** ✅
  - `POST .../sprints/{id}/rollover` — tự động chuyển task chưa hoàn thành sang sprint planned tiếp theo (hoặc backlog), ghi activity log. 6 unit tests, 137/137 green. **PR #94 merged.**

#### 🎨 Agent: OpenCode (Frontend) — Agent C & A
- [x] **F20.1: Custom Field Values on Kanban Cards (Agent C)** ✅
  - Render `TaskCustomFieldValue` trên TaskCard (badge nhỏ dưới title) + `CustomFieldsSection` hiển thị values trong TaskDetailPanel. Dùng `getTaskFieldValues` API có sẵn. **Merged (main aa510b5).**
- [x] **F20.2: Cycle/Lead Time & Velocity Trend Charts (Agent C)** ✅
  - `CycleLeadTimeChart.tsx` + `VelocityTrendChart.tsx` wired vào ReportsPage (kèm `TeamPerformancePanel`). Đã connect với backend B20.1/B20.2 — chart hiển thị data thật. **Merged (main aa510b5).**
- [x] **F20.3: Team Performance Dashboard (Agent A)** ✅
  - `TeamPerformancePanel.tsx` (P50/P90 cycle/lead tiles) + `CumulativeFlow.tsx` (CFD từ `tasksByStatus`). **PR #94 merged.**

---

---

### 📈 Sprint 21 — Live Team Experience (Realtime Notifications + My Work + Dashboard) ✅ Complete

**Goal:** Turn DevFlow into a live collaborative workspace — real-time notification push, cross-project personal task view, and richer dashboard analytics.

> **Gaps verified in code:** All 5 gaps closed. `NotificationBroadcaster` dead code removed. `CreateCommentCommandHandler` now pushes realtime via SignalR. Email preference check enforced before sending. Email links are real deep links with `FRONTEND_URL`. "My Tasks" cross-project page shipped. Dashboard cycle/lead time tiles added.

#### 🤖 Agent: Codebuff (Backend) — Agent B
- [x] **B21.1: Real-time Notification Push via SignalR** ✅ (PR #98, merged)
  - `IRealtimeNotificationService` → `SignalRNotificationService` (Api layer, dùng `IHubContext<NotificationHub>`).
  - Inject vào `CreateCommentCommandHandler` (gọi `NotifyUserAsync` sau khi tạo Notification entity).
  - Inject vào `UpdateTaskItemCommandHandler` (broadcast khi task được assign + persist Notification entity).
  - Frontend `useNotifications` hook đã lắng nghe `connection.on("notification")` — backend push đúng shape.
- [x] **B21.2: Notification Preferences Enforcement** ✅
  - `INotificationPreferencesRepository` + implement.
  - Check `EmailOnMention`/`EmailOnAssignment` trước khi gọi email service.
- [x] **B21.3: Real Email Links** ✅
  - `ResendEmailService` — thay `<a href="#">` bằng URL thật từ `FRONTEND_URL` config.
  - Thêm workspaceId/projectId/taskId vào param email methods.

#### 🎨 Agent: OpenCode (Frontend) — Agent C
- [x] **F21.1: Dashboard Cycle/Lead Time Tiles** ✅ (PR #96, merged)
  - `DashboardCycleLeadChart.tsx` — 4 stat tiles (P50/P90 cycle/lead) gọi `GET .../reporting/cycle-lead-time`.
  - DashboardPage workspace-level → project selector (dùng project đầu tiên).
- [x] **F21.2: Export Enhancement (CSV chart data)** ✅
  - Export CSV button cho chart data (CycleLeadTimeChart).

#### 🚀 Agent A (Team Lead)
- [x] **A21.1: My Tasks Cross-Project Page (Backend + Frontend)** ✅ (PR #97, merged)
  - `GET /api/v1/workspaces/{wsId}/my-tasks` — trả tasks assigned to current user across all projects.
  - `MyTasksPage.tsx` — card/table list, click → navigate to board.
  - `AppShell.tsx` — nav item "My Tasks".
  - Test: 3+ unit tests (6 written, 152/152 green).
- [x] **A21.2: Review & merge B/C PRs** ✅ (PR #96, #97, #98 all merged)

---

### 📈 Sprint 22 — Observability & Collaboration Depth (Activity Log + Notifications + UI Depth + Search) — 4 AGENTS

**Goal:** Đào sâu vào observability (activity log), notification lifecycle, UI visualization depth, và search/reporting depth.

> **Gaps verified in code:** Task create/update/delete, comment, subtask handlers không ghi ActivityLog. `StartSprintCommandHandler` không gửi notification/email. Outbox pattern được scaffold nhưng không handler nào ghi OutboxMessage. Notification không có cleanup. EpicsPage thiếu progress. Dependency graph là list, không phải DAG. Search chỉ cover task title/desc + project. Team Report thiếu per-member breakdown.

#### 🤖 Agent B (Backend — Codebuff)
- [x] **B22.1: Sprint Start Notification** — PR #100 ✅
  - `StartSprintCommandHandler` → persist Notification + realtime push + email cho mọi member (tôn trọng `EmailOnSprintStarted`).
- [x] **B22.2: Outbox Wiring** — PR #100 ✅
  - `EnqueueAsync("webhook.sprint.started")` → OutboxDispatcher persist; OutboxProcessor (BackgroundService) dispatch webhook.
- [x] **B22.3: Notification Cleanup** — PR #100 ✅
  - `POST /notifications/cleanup?days=90` xóa notification cũ, scope theo user.

#### 🎨 Agent C (Frontend — OpenCode)
- [x] **C22.1: Epic Progress Visualization** — PR #101 ✅
  - Progress bar + completion badge + due indicator trên EpicsPage.
- [x] **C22.2: Dependency Graph DAG Viz** — PR #101 ✅
  - GraphModal đã là SVG DAG (từ Sprint 19 KILO), giữ nguyên — không redo.
- [x] **C22.3: Notification UX** — PR #101 ✅
  - Mark-all-read + cleanup buttons + filter tabs + "all caught up" empty state.

#### 🚀 Agent D (Fullstack — mới)
- [x] **D22.1: Search Enhancement** — PR #102 ✅
  - Backend: search comments, epics, labels, users. Frontend: tabbed results + command palette.
- [x] **D22.2: Team Report Depth** — PR #102 ✅
  - Backend: per-member breakdown + trend indicators. Frontend: member table + trend chips.

#### 🚀 Agent A (Team Lead)
- [x] **A22.1: Activity Log Coverage** — PR #99 ✅
  - Thêm ActivityLog vào task create/update/delete, subtask, comment handlers.
  - Test: 3+ unit tests (153/153 green).
- [x] **A22.2: Review & merge B/C/D PRs** — #100 (B), #101 (C), #102 (D) ✅



### 🚀 Sprint 24 — Real Caching, Google OAuth, Live Presence, Import/Export — 4 AGENTS ✅ Complete

**Goal:** Hiện thực hóa cache thật (Sprint 17 chỉ scaffold), mở khoá đăng nhập social (Google OAuth giữ JWT), presence realtime trên board, và full import/export project.

> **Gaps verified in code:** Redis cache Sprint 17 tuyên bố nhưng chưa handler nào dùng thật; chỉ có JWT password login; board chưa có presence; chưa có import/export.

#### 🤖 Agent B (Backend — Cache)
- [x] **B24.1: Real Redis Caching** — PR #105 ✅
  - `RedisCacheService.GetOrSetAsync` + `NullCacheService` fallback (không crash khi thiếu Redis).
  - `CacheInvalidationBehavior` pipeline — invalidate `project:{id}` tag sau mọi `IProjectEvent` command.
  - Cache ListTaskItems (TTL 30s), Dashboard (TTL 60s, tagged all project ids), CycleLeadTime + VelocityHistory (TTL 30s).
  - Rate limit `AuthenticatedPermitLimit` 400→800. Tests: 167/167 green.

#### 🚀 Agent A (Team Lead — Google OAuth)
- [x] **A24.1: Google OAuth (Authorization Code + PKCE)** — PR #107 ✅
  - Backend: `SocialLogin` entity + `social_logins` table, `IExternalIdentityProvider` (Infrastructure HTTP), `OAuthExchangeCommandHandler` (Application, testable), `GET /auth/oauth/config` + `POST /auth/oauth/exchange`.
  - Frontend: `lib/oauth.ts` (PKCE helpers), `GoogleSignInButton` (feature-flag off khi chưa config), `setSessionFromTokens` trong AuthContext.
  - Giữ nguyên JWT — OAuth chỉ link tài khoản qua email verified. 4 unit tests mới.
  - **Hotfix:** main bị broken khi PR #106 merge trước PR #108 (BoardPage import file chưa tồn tại) — merge PR #108 fix.

#### 🎨 Agent C (Frontend — Presence & UX)
- [x] **C24.1: Live Presence Avatars** — PR #108 ✅
  - `usePresence` hook (SignalR project group `user-joined`/`user-left`) + `BoardPresence` component (5 avatars + +N).
- [x] **C24.3: Inline Child Task Creation** — TaskCard inline form (POST subtasks).
- [x] **C24.4: Comment Skeleton + Tab Title** — Skeleton loaders, `document.title` = project name.

#### 🚀 Agent D (Fullstack — Import/Export)
- [x] **D24.1: Full Project Import/Export** — PR #106 ✅
  - Export: JSON + Excel (ClosedXML) — tasks, subtasks, epics, labels, custom fields.
  - Import: JSON + Excel với round-trip backup; `ExportImportModal.tsx` UI.
- [x] **D24.2: Search Enhancement** — backend search comments/epics/labels/users.

#### 🚀 Agent A (Team Lead)
- [x] **A24.2: Review & merge B/C/D PRs** — #105 (B), #106 (D), #107 (A), #108 (C) ✅
- Tests: 175/175 unit tests green (tăng 167→175 nhờ OAuth + ImportExport).

### 🛡️ Sprint 25 — Guardrails & Collaboration Depth (RBAC + Presence + Watchers + Activity) ✅ Complete

**Goal:** Hardening bảo mật (RBAC), sửa presence realtime, thêm task watchers, và biến activity log thành công cụ truy vết.

> **Gaps verified in code:** Import/Export backup + DeleteEpic chỉ yêu cầu Member (lỗ hổng); `ProjectHub` không broadcast presence event (avata không hoạt động); `usePresence` đọc localStorage key không tồn tại; activity log không filter/không phân trang.

#### 🚀 Agent A (Team Lead — RBAC Hardening)
- [x] **A25.1: RBAC Security Audit & Hardening** — PR #109 ✅ (merged)
  - Audit toàn bộ 47 `RequireWorkspaceRole` attributes → tìm 3 lỗ hổng under-privileged.
  - `ImportProjectBackup` Member → **Admin** (ghi dữ liệu vào project).
  - `ExportProjectBackup` Member → **Admin** (full data dump, exfiltration risk).
  - `DeleteEpic` Member → **Admin** (đồng bộ với DeleteTask).
  - 9 unit tests `RbacAuthorizationTests` — 184/184 green (tăng 175→184).
- [x] **A25.2: Sprint 25 plan + prompts B/C/D** — `docs/sprint25/prompt-{B,C,D}.md`

#### 🤖 Agent B (Backend — Presence + Watchers) ✅
- [x] **B25.1: Presence broadcast** — PR #111 ✅ — ProjectHub broadcast `user-joined`/`user-left`.
- [x] **B25.2: Task Watchers** — PR #111 ✅ — entity + migration + repository + CQRS + notify watchers trên comment/status change.

#### 🎨 Agent C (Frontend — Role UI + Presence Fix) ✅
- [x] **C25.1: Fix `usePresence`** — PR #112 ✅ — đọc selfId từ AuthContext (bỏ localStorage không tồn tại).
- [x] **C25.2: Role-aware UI** — PR #112 ✅ — ẩn import/export backup/delete epic với Member (`isAdmin`).

#### 🚀 Agent D (Fullstack — Activity Transparency) ✅
- [x] **D25.1: Backend** — PR #110 ✅ — `ListActivitiesQuery` filter actor/task/action/date + phân trang.
- [x] **D25.2: Frontend** — PR #110 ✅ — ActivitiesPage filter bar + pagination.

#### 🔧 Sprint 25 follow-ups (post-sprint, merged)
- PR #113, #114 — Google OAuth redirect to `/login` (SPA), keep `feat/backend-sprint25-oauth-setup` live.
- PR #115 — dashboard crash fix when cycle/lead time metrics null.
- PR #116 — notification UI overhaul (actorName, unread endpoint, hook refactor, panel fixes).

---

### 🚀 Sprint 26 — Performance & Data Integrity Hardening ✅

**Goal:** Sửa các implementation còn nông (shallow) trước khi scale: dashboard/search N+1, notification prefs bị bỏ qua bởi pipeline, outbox retry vô hạn, không có soft-delete, watchers backend nhưng thiếu UI, và CI không có safety rails.

> **Plan:** `docs/sprint26/plan.md` — 9 tasks / 4 agents.

> **PRs:** #117 (B26.1+2), #119 (A26.1-3), #118 (D26.1-2 + C26.1-2).

#### 🚀 Agent A (Team Lead — Backend Performance & Correctness)
- [x] **A26.1: Dashboard single-query + actor names** — batch `GetForProjectsAsync` (window function), resolve `ActorName` qua `GetDisplayNamesAsync`, fallback "Someone".
- [x] **A26.2: Outbox DLQ / retry cap** — `MaxRetries = 10`, `FailedPermanentlyAt`, `CanRetry`; `GetUnprocessedAsync` loại message dead-lettered.
- [x] **A26.3: Sprint DELETE endpoint** — `DELETE .../sprints/{sprintId}` (Admin), tasks về backlog, activity log.
- [x] **A26.4: Review & merge B/C/D PRs** — cố định i18n parity + soft-delete restore bug (xem bên dưới); merge #118.

#### 🤖 Agent B (Backend — Notification & Data Integrity)
- [x] **B26.1: Unified notification preferences** — `NotificationBehavior` check `InApp*` prefs trước khi tạo notification; thêm in-app mute toggles.
- [x] **B26.2: Soft-delete + archive-restore** — `DeletedAtUtc` + global query filter + `SoftDeleteInterceptor`; `RestoreProjectCommand` + `POST .../projects/{id}/restore`. *(Follow-up fix: `Archive()` giờ stamp `DeletedAtUtc`; `Restore()` xoá nó; `GetByIdIncludingDeletedAsync` bỏ query filter — soft-delete path trước đó không hoạt động end-to-end.)*

#### 🎨 Agent C (Frontend — Watchers UI + Dashboard)
- [x] **C26.1: Task watcher UI** — watch/unwatch eye toggle trong `TaskDetailPanel.tsx` + `api.ts` (`watchTask`/`unwatchTask`/`isWatchingTask`).
- [x] **C26.2: Dashboard actor names + empty states** — `actorName` fallback + upcoming-deadlines section + empty states.

#### 🚀 Agent D (Frontend Tests + CI Safety)
- [x] **D26.1: Vitest + first FE tests** — vitest + testing-library + jsdom; 30 tests (utils, components, i18n parity); `npm run test`.
- [x] **D26.2: CI safety rails** — auto-merge chạy trên `pull_request_review` (approved) thay vì mở PR; integration tests trên Postgres 17 service container; `tsc --noEmit`; `BRANCH_PROTECTION.md`.



### 🚀 Sprint 27 — Search & Event Coverage ✅ Complete

**Goal:** Xử lý các gap bị defer từ Sprint 26 (global search rewrite, DB backup) + bịt lỗ hổng email/toggle cho 4 event type, thêm UI restore project, và phủ unit test cho 8 feature chưa có test.

> **Plan:** `docs/sprint27/plan.md` — 8 tasks / 4 agents.
> **Prompts:** `docs/sprint27/prompts/prompt-{B,C,D}.md`.

#### 🚀 Agent A (Team Lead — Backend Search Rewrite)
- [x] **A27.1: Global search DB-level + pagination** — thay in-memory LINQ + N+1 (`SearchQueryHandler` loop project/task) bằng `EF.Functions.ILike` trên PostgreSQL + 1 query/entity type + pagination metadata. *(PR #121)*
- [x] **A27.2: Review & merge B/C/D PRs** — chạy `dotnet test`/`npm run build` + i18n parity; update AGENT_STATUS.md. *(PRs #120, #122, #123 merged)*

#### 🤖 Agent B (Backend — Email Coverage + Test Gaps)
- [x] **B27.1: Email templates + toggles cho 4 event type** — `StatusChanged`, `CommentAdded`, `RoleChanged`, `RemovedFromWorkspace`: thêm 4 method `IEmailService` + 8 prefs booleans (`EmailOn*`/`InAppOn*`) + migration + wire vào `NotificationBehavior`/handlers. *(PR #122)*
- [x] **B27.2: Unit tests cho feature chưa test** — GitHub webhook HMAC + `TaskKeyParser`, Labels, Templates, Email (26 tests). *(PR #122)*

#### 🎨 Agent C (Frontend — Search UI + Archive/Restore)
- [x] **C27.1: Paginated search UI** — consume pagination metadata từ A27.1 (`SearchResponse.pagination.*`), result counts + load-more. *(PR #123)*
- [x] **C27.2: Archived-project list + Restore UI** — `restoreProject` API + status badge + Restore button (Admin-gated) trên project card; empty state. *(PR #123)*

#### 🚀 Agent D (Frontend + Infra — Prefs UI + DB Backup)
- [x] **D27.1: Notification-preferences settings UI** — 4 toggle groups mới (StatusChanged/CommentAdded/RoleChanged/RemovedFromWorkspace) trên `SettingsPage.tsx`. *(PR #120)*
- [x] **D27.2: DB backup automation** — `scripts/backup-db.sh` + `.github/workflows/backup.yml` (daily pg_dump) + `docs/sprint27/runbook-backup.md`. *(PR #120)*

### 🚀 Sprint 28 — Webhook Reliability & Project Mgmt UX ✅ Complete

**Goal:** Bịt P0 — webhook delivery failures bị `catch {}` nuốt nên DLQ không bao giờ được populate; thêm admin retry endpoint. Đồng thời phủ test 4 feature folders trống, hiện thực hóa reporting trends, thêm search sort + custom-field search, UI project settings, component library (Dialog/EmptyState), workspace analytics tiles, mention filter + vi.json.

> **PRs:** #124 (A28.1), #125 (B), #127 (D), #128 (A28.2 UX: optimistic auth + activity feed pagination), #129 (C), #130 (A28.2 UX fixes: keepalive /health robustness + task comments cold-start retry).

> **Plan:** `docs/sprint28/plan.md` — 8 tasks / 4 agents.
> **Prompts:** `docs/sprint28/prompts/prompt-{B,C,D}.md`.

#### 🚀 Agent A (Team Lead — Backend Webhook DLQ)
- [x] **A28.1: Webhook DLQ fix + admin retry endpoint** — bỏ `catch {}` trong `WebhookDispatcher.DispatchAsync` để lỗi propagate lên OutboxProcessor (retry 10× → dead-letter); thêm `GetDeadLetteredAsync`/`ResetRetryAsync` cho `IOutboxRepository`; `GET /admin/outbox/dead-letter` + `POST /admin/outbox/{id}/replay`. *(PR #124 merged)*
- [x] **A28.2: Review & merge B/C/D PRs** — chạy `dotnet test`/`npm run build` + i18n parity; update AGENT_STATUS.md. *(PRs #124, #125, #127, #128, #129, #130 all merged; bonus UX fixes: optimistic auth load + ActivityFeed pagination #128, keepalive /health robustness + task comments cold-start retry #130)*

#### 🤖 Agent B (Backend — Tests + Reporting/Search)
- [x] **B28.1: Unit tests cho 4 feature folders** — `BulkOperations`, `Export`, `Import`, `Users` (≥2 tests/folder, NSubstitute). *(PR #125 merged)*
- [x] **B28.2: Reporting trends + search sort + custom-field search** — `TeamReportTrends` real deltas; `sortBy`/`sortDir` (whitelist SQL-safe keys); `SearchCustomFieldsAsync` (ILike). *(PR #125 merged)*

#### 🎨 Agent C (Frontend — Project Settings + Search UX)
- [x] **C28.1: Project edit UI + Dialog/EmptyState** — `components/ui/Dialog.tsx` + `EmptyState.tsx`, migrate ConfirmDialog + 1 modal, `updateProject` PATCH, Edit button (Admin-gated). *(PR #129 merged)*
- [x] **C28.2: Search filter parity + sort** — assignee/label/due filters, sort controls, apply-saved-search dropdown. *(PR #129 merged)*

#### 🚀 Agent D (Frontend — Analytics + Notifications + i18n)
- [x] **D28.1: Workspace-level analytics tiles** — wire `getTeamReport` vào Dashboard (completed delta, per-member load, minutes), sprint health card, "View reports" link. *(PR #127 merged)*
- [x] **D28.2: Mention filter + settings link + vi.json** — "Mentions" tab (client-side `type.toLowerCase() === "mention"`), `/settings#notifications` deep-link, translate `savedSearch`/`commandPalette` vi.json values. *(PR #127 merged)*

---

### 🚀 Sprint 29 — File Upload Safety & Settings Polish ✅ Complete

**Goal:** Chặn crash từ upload file quá lớn trên Render (bytea không giới hạn), thêm rename workspace/sprint/template (thiếu PUT endpoints), hoàn thiện bulk operations UX + attachment upload UX, dịch nốt 122 key vi.json, thêm unread badge cho AppShell.

> **Plan:** `docs/sprint29/plan.md` — 8 tasks / 4 agents.
> **Prompts:** `docs/sprint29/prompts/prompt-{B,C,D}.md`.

#### 🚀 Agent A (Team Lead — Backend File Safety + Settings)
- [x] **A29.1: File upload size limit + type whitelist** — `[RequestSizeLimit(10 MB)]` + `[RequestFormLimits]` trên `UploadAttachment`; whitelist type (image/pdf/text/json/office); reject `.exe/.dll/.bat/.sh/.cmd/.ps1/.js/.vbs/.scr`; `Kestrel:MaxRequestBodySize`. *(PR #133 merged)*
- [x] **A29.2: Workspace PUT + Sprint PUT + Template PUT** — `UpdateWorkspaceCommand` (name/desc), `UpdateSprintCommand` (name/goal), `UpdateTemplateCommand` (name/desc); Admin-gated; 12 unit tests mới. *(PR #133 merged)*
- [x] **A29.3: Review & merge B/C/D PRs** — `dotnet test`/`npm run build` + i18n parity; update AGENT_STATUS.md. *(PRs #142, #143 merged; bonus fix: upload XHR auth token)*

#### 🤖 Agent B (Backend — Attachments + Notifications Depth) ✅
- [x] **B29.1: Attachment pagination + cache headers** — `GetForTaskPagedAsync(skip/take)` + total; `Last-Modified`/`Cache-Control` + `Content-Disposition` (inline image/pdf, attachment khác). *(PR #142 merged)*
- [x] **B29.2: Notification batch-delete + unread-count** — `POST /notifications/batch-delete`; `GET /notifications/unread-count?workspaceId=` hiệu quả. *(PR #142 merged)*
- [x] **B29.3: Tests mới** — 10 tests (attachment pagination, batch-delete, Update handlers); 301/301 unit tests green. *(PR #142 merged)*

#### 🎨 Agent C (Frontend — Bulk Ops + Attachment UX) ✅
- [x] **C29.1: Bulk operations UI** — checkbox select-all per column header (indeterminate), floating batch action bar (count + status/assignee/delete/clear), keyboard Ctrl+A/Esc. *(PR #143 merged)*
- [x] **C29.2: Attachment upload progress/error/retry** — XHR progress bar per file, client validation (>10 MB + dangerous ext), upload queue (max 5), retry per file. *(PR #143 merged; A29.3 fix: XHR auth token)*

#### 🚀 Agent D (Frontend + i18n — Settings UI + i18n) ✅
- [x] **D29.1: Workspace/Sprint/Template edit UI** — Dialog + `updateWorkspace`/`updateSprint`/`updateTemplate`, Admin-gated. *(PR #143 merged)*
- [x] **D29.2: vi.json 122 keys + AppShell badge** — dịch nốt label/customField/webhook/github/sections; unread count badge trên bell trong sidebar. *(PR #143 merged; 100+ vi.json keys translated, 1129 keys en/vi parity 100%)*

---

### 🚀 Sprint 30 — Webhook Admin UI, Watcher List, Security Fixes & Polish ✅ Complete

**Goal:** Bịt P0 authorization gap (template update không kiểm tra project scoping), hiện thực hóa DLQ admin UI (backend đã có từ A28.1 nhưng chưa có UI), thêm watcher list (backend + UI), mở rộng integration tests, áp dụng EmptyState vào 5 pages, cập nhật README roadmap đã lỗi thời.

> **Plan:** `docs/sprint30/plan.md` — 8 tasks / 4 agents.
> **Prompts:** `docs/sprint30/prompts/prompt-{B,C,D}.md`.
> **PRs:** #145 (A30.1), #146 (A30.2), #147 (B30.1+2), #148 (C30.1+2 + D30.1+2).

#### 🚀 Agent A (Team Lead — Backend Security + Docs) ✅
- [x] **A30.1: Template scoping fix** — `UpdateTemplateCommandHandler` verify `template.ProjectId == request.ProjectId` → NotFound (mirror `UpdateSprintCommandHandler`); 2 unit tests mới. *(PR #145 merged)*
- [x] **A30.2: README/docs cleanup** — `README.md` 50→303 unit tests + tick shipped features; `docs/sprint30/plan.md` + prompts. *(PR #146 merged)*
- [x] **A30.3: Review & merge B/C/D PRs** — chạy `dotnet test`/`npm run build` + i18n parity; fix review findings (username/displayName mapping, integration-test DB race) trước khi merge. *(PRs #147, #148 merged)*

#### 🤖 Agent B (Backend — Watchers + Integration Tests) ✅
- [x] **B30.1: `GetTaskWatchersQuery` + endpoint** — `GET /tasks/{taskId}/watchers` (userId/username/displayName), handler mirrors `IsWatchingTaskQueryHandler`, bulk `GetByIdsAsync`, 5 unit tests. *(PR #147 merged; fix: return real username via new `IUserRepository.GetByIdsAsync`)*
- [x] **B30.2: `ProjectAndSprintIntegrationTests.cs`** — flow register→login→workspace→project→sprint→task→PATCH InProgress; shared collection fixture fix (two hosts raced on EF Migrate → `pg_type_typname_nsp_index`); 308/308 unit tests + integration green. *(PR #147 merged)*

#### 🎨 Agent C (Frontend — Watcher List + DLQ UI) ✅
- [x] **C30.1: Watcher list in `TaskDetailPanel`** — `getTaskWatchers` API, avatars + names + count, refetch sau toggle watch. *(PR #148 merged)*
- [x] **C30.2: DLQ admin UI trên `WebhooksPage`** — section "Dead Letter Queue" (Admin-gated), list dead-lettered messages + per-row Replay, reuse EmptyState. *(PR #148 merged)*

#### 🚀 Agent D (Frontend + i18n — EmptyState + DLQ i18n) ✅
- [x] **D30.1: EmptyState adoption** — 5 pages (Activities/Board/CustomFields/GitHub/MyTasks) dùng `<EmptyState>` component; 21 file còn lại defer Sprint 31+. *(PR #148 merged)*
- [x] **D30.2: outbox i18n keys** — `outbox.*` en+vi (dlqTitle/dlqDescription/dlqEmpty/replay/...), i18n parity green. *(PR #148 merged)*

---

### 🚀 Sprint 31 — Project-Level RBAC, Outbox Admin Batch, EmptyState Sweep & Depth Polish ✅ Complete

**Goal:** Hiện thực hóa RBAC cấp project (mới — workspace-only trước đây), admin batch ops cho outbox DLQ (replay-all/purge), thêm epic-to-epic dependencies, và áp dụng rộng rãi `<EmptyState>` component trên toàn frontend.

> **Plan:** `docs/sprint31/plan.md` — 8 tasks / 4 agents.
> **Prompts:** `docs/sprint31/prompts/prompt-{B,C,D}.md`.
> **PRs:** #149 (docs), #150 (A31.1+2), #151 (B31.1-3), #152 (C31.1+2), #153 (D31.1+2).

#### 🚀 Agent A (Team Lead — Backend ProjectMember + RBAC) ✅
- [x] **A31.1: `ProjectMember` entity + migration + repository** — bảng `project_members`, `ProjectMemberRole` (Member/Manager), repository CRUD + `GetByProjectAsync`. *(PR #150 merged)*
- [x] **A31.2: Member CQRS endpoints** — `GET/POST /projects/{projectId}/members`, `PATCH/DELETE /members/{userId}`; Manager-gated; `ProjectAuthorizationBehavior` pipeline guard (project-scoped RBAC song song workspace RBAC). *(PR #150 merged)*
- [x] **A31.3: Review & merge B/C/D PRs** — chạy `dotnet test`/`npm run build` + i18n parity; rebase C lên main (D đã merge trước) resolve 10 conflicts; fix duplicate `EmptyState` import. *(PRs #150, #151, #152, #153 all merged)*

#### 🤖 Agent B (Backend — Outbox Batch + Epic Deps + RBAC Guard) ✅
- [x] **B31.1: Outbox replay-all/purge** — `POST /outbox/dead-letter/replay-all` → `{requeued:n}`, `DELETE /outbox/dead-letter` → `{deleted:n}`; Admin-gated. *(PR #151 merged)*
- [x] **B31.2: Epic-to-epic dependencies** — `GET/POST /epics/{epicId}/dependencies`, `DELETE /dependencies/{blockedByEpicId}`; `EpicResponse` gain `blockedByEpicIds`. *(PR #151 merged)*
- [x] **B31.3: `ProjectAuthorizationBehavior`** — MediatR pipeline attribute quản lý truy cập theo project role; unit tests. *(PR #151 merged)*

#### 🎨 Agent C (Frontend — Project Member UI + DLQ Batch) ✅
- [x] **C31.1: `ProjectSettingsPage`** — member list/add/remove/role-update, add-member dropdown từ workspace members. *(PR #152 merged)*
- [x] **C31.2: DLQ Replay-all/Purge buttons** — trên `WebhooksPage`, confirm dialogs + loading states; `replayAllDeadLetterMessages`/`purgeDeadLetterMessages` API. *(PR #152 merged)*

#### 🚀 Agent D (Frontend + i18n — EmptyState Sweep + Epic Deps UI) ✅
- [x] **D31.1: EmptyState sweep** — `SprintHealthCard`, `CumulativeFlow`, `TeamPerformancePanel`, `BurndownChart`, `ImportTasksModal`, `ExportImportModal`, `LabelsPage`, `TemplatesPage`, `WorkspacePage`, `DashboardPage`, `SprintPlanningPage`, `WebhooksPage`, `EpicsPage`, ...; widen `EmptyState` props (`title`/`description` → `React.ReactNode`). *(PR #153 merged)*
- [x] **D31.2: Epic deps UI + i18n** — "Blocked by" expandable section + add/remove dependency picker (Admin) trên `EpicsPage`; `epic.*` blocker keys + `outbox.*` batch keys en+vi. *(PR #153 merged)*

---

## 🔒 Multi-Agent Coordination Guidelines

1. **Branch Prefixes:**
   * Backend (`src/`): `feat/backend-sprintXX-<feature>`
   * Frontend (`frontend/src/`): `feat/frontend-sprintXX-<feature>`
2. **Conflict Prevention:**
   * Backend commits Swagger/OpenAPI models and unit tests before Frontend wires UI.
   * Shared files (`Program.cs`, `package.json`, `api.ts`) require single-agent lock before editing.
3. **Quality Gates:**
   * All backend PRs require `dotnet test` (100% green).
   * All frontend PRs require `npm run build` & TypeScript strict typecheck.

---

*DevFlow Architecture Team — Updated 2026-08-25 (Sprint 31 Complete ✅)*

