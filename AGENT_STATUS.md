# 🚀 AGENT STATUS & BIG UPDATE ROADMAP — DevFlow 2.0

> **Current Milestone:** DevFlow 2.0 Enterprise & Performance Evolution  
> **Status:** Sprint 17 Complete ✅ | Sprint 18 Complete ✅ | Sprint 19 Complete ✅ | Sprint 20 Complete ✅ | **Sprint 21 In Progress 🎯**

---

| Sprint | Focus Area | Backend (Codebuff) | Frontend (OpenCode) | Status |
|---|---|---|---|---|
| **Sprint 16** | Personalization & Workflows | ✅ DONE (B1-B4) | ✅ DONE (F1-F4) | Complete |
| **Sprint 17** | Performance Hardening & State Sync | ✅ DONE (B17.1-B17.4) | ✅ DONE (F17.1-F17.4) | Complete |
| **Sprint 18** | Epics, Subtasks & Task Hierarchy | ✅ DONE (B18.1-B18.3) — PR #77 | ✅ DONE (F18.1-F18.3) — PR #89-91 | Complete |
| **Sprint 19** | GitHub Integration & Webhook Outbox | ✅ DONE (B19.1-B19.3) — PR #93 | ✅ DONE (F19.1-F19.3) — PR #92 | Complete ✅ |
| **Sprint 20** | Advanced Agile Analytics & Custom Fields | ✅ DONE (B20.1-3) — PR #94, #95 | ✅ DONE (F20.1-3) — PR #94 | Complete ✅ |
| **Sprint 21** | Live Team Experience (Notifications + My Work + Dashboard) | ⏳ B21.1-3 (Agent B) | ⏳ F21.1-2 (Agent C), A21.1-2 (Agent A) | In Progress 🎯 |

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

### 📈 Sprint 21 — Live Team Experience (Realtime Notifications + My Work + Dashboard)

**Goal:** Turn DevFlow into a live collaborative workspace — real-time notification push, cross-project personal task view, and richer dashboard analytics.

> **Gaps verified in code:** `NotificationBroadcaster` registered in DI but never called (dead code). `CreateCommentCommandHandler` creates notifications but never pushes via SignalR. No email preference check before sending. Email links are dead `<a href="#">`. No "My Tasks" cross-project page. Dashboard lacks cycle/lead time tiles.

#### 🤖 Agent: Codebuff (Backend) — Agent B
- [ ] **B21.1: Real-time Notification Push via SignalR**
  - `IRealtimeNotificationService` → `SignalRNotificationService` (Infrastructure layer, dùng `IHubContext<NotificationHub>`).
  - Inject vào `CreateCommentCommandHandler` (gọi `NotifyUserAsync` sau khi tạo Notification entity).
  - Inject vào `UpdateTaskItemCommandHandler` (broadcast khi task được assign).
  - Frontend `useNotifications` hook đã lắng nghe `connection.on("notification")` — chỉ cần backend push đúng shape.
- [ ] **B21.2: Notification Preferences Enforcement**
  - `INotificationPreferencesRepository` + implement.
  - Check `EmailOnMention`/`EmailOnAssignment` trước khi gọi email service.
- [ ] **B21.3: Real Email Links**
  - `ResendEmailService` — thay `<a href="#">` bằng URL thật từ `FRONTEND_URL` config.
  - Thêm workspaceId/projectId/taskId vào param email methods.

#### 🎨 Agent: OpenCode (Frontend) — Agent C
- [ ] **F21.1: Dashboard Cycle/Lead Time Tiles**
  - `DashboardCycleLeadChart.tsx` — 4 stat tiles (P50/P90 cycle/lead) gọi `GET .../reporting/cycle-lead-time`.
  - DashboardPage workspace-level → cần project selector (hoặc dùng project đầu tiên).
- [ ] **F21.2: Export Enhancement (CSV chart data)**
  - Export CSV button cho chart data (CycleLeadTimeChart).

#### 🚀 Agent A (Team Lead)
- [ ] **A21.1: My Tasks Cross-Project Page (Backend + Frontend)**
  - `GET /api/v1/workspaces/{wsId}/my-tasks` — trả tasks assigned to current user across all projects.
  - `MyTasksPage.tsx` — card/table list, click → navigate to board.
  - `AppShell.tsx` — nav item "My Tasks".
  - Test: 3+ unit tests.
- [ ] **A21.2: Review & merge B/C PRs**



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

*DevFlow Architecture Team — Updated 2026-08-23*

