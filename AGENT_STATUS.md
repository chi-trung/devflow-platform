# 🚀 AGENT STATUS & BIG UPDATE ROADMAP — DevFlow 2.0

> **Current Milestone:** DevFlow 2.0 Enterprise & Performance Evolution  
> **Status:** Sprint 16 Backend Complete ✅ | Sprint 17 Planning & Execution Active ⚡

---

## 📊 Quick Status Matrix

| Sprint | Focus Area | Backend (Codebuff) | Frontend (OpenCode) | Status |
|---|---|---|---|---|
| **Sprint 16** | Personalization & Workflows | ✅ DONE (B1-B4) | ✅ DONE (F1-F4) | Complete |
| **Sprint 17** | Performance Hardening & State Sync | ⏳ Ready | ⏳ Ready | 🎯 Next Up |
| **Sprint 18** | Epics, Subtasks & Task Hierarchy | ⏳ Planned | ⏳ Planned | Queued |
| **Sprint 19** | GitHub Integration & Webhook Outbox | ⏳ Planned | ⏳ Planned | Queued |
| **Sprint 20** | Advanced Agile Analytics & Custom Fields | ⏳ Planned | ⏳ Planned | Queued |

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

> **⚠️ Backend follow-up for F3 fidelity (Codebuff, B16.5):**
> `GET .../tasks` currently orders by `CreatedAtUtc DESC` and `TaskItemResponse` does not
> expose `Position`. Reorder saves correctly to DB, but reload ignores saved order.
> Fix = order by `Position` in `TaskItemRepository.GetForProjectPagedAsync` + add
> `position` to `TaskItemResponse`. Frontend already sends/consumes it.

---

### ⚡ Sprint 17 — Performance, Stability & Cache Hardening (Big Update Core)

**Goal:** Eliminate all Render cold start delays, rate-limit bottlenecks, and optimize query latency to sub-50ms.

#### 🤖 Agent: Codebuff (Backend)
- [ ] **B17.1: Redis Output & Query Caching**
  - Cache workspace metadata, member lists, and active sprint snapshots with automated cache tag invalidation.
- [ ] **B17.2: Sliding-Window Rate Limiting & Tiering**
  - Upgrade rate limiter to sliding window per user token / authenticated identity (with higher quota for active UI sessions).
- [ ] **B17.3: Outbox Pattern & Background Workers**
  - Implement reliable background worker for notifications and webhooks with exponential backoff retries.
- [ ] **B17.4: Health Check & Keepalive Endpoint Optimization**
  - Dedicated lightweight probe `/api/v1/ping` with database keepalive query for zero-cold-start hosting.

#### 🎨 Agent: OpenCode (Frontend)
- [ ] **F17.1: Global Request Deduplication & Stale-While-Revalidate Caching**
  - Upgraded API client caching layer with instant UI cache hit + background sync.
- [ ] **F17.2: SignalR Auto-Reconnection & Resilience Guard**
  - Backoff reconnect logic with silent offline queued mutations and optimistic UI updates.
- [ ] **F17.3: Virtualized Board Columns for Large Projects (500+ tasks)**
  - Smooth 60fps scrolling and dragging on high-density Kanban boards.
- [ ] **F17.4: Keepalive Cron Service Integration**
  - Client-side background ping helper and warm-up indicator.

---

### 🌲 Sprint 18 — Epics, Subtasks & Hierarchy

**Goal:** Transform tasks into full hierarchical project trees (Epic $\rightarrow$ Task $\rightarrow$ Subtask).

#### 🤖 Agent: Codebuff (Backend)
- [ ] **B18.1: Epic Entity & API**
  - `GET/POST/PUT/DELETE /api/v1/workspaces/{wsId}/projects/{projId}/epics`
  - Epic progress computation (% completed tasks, story point totals).
- [ ] **B18.2: Subtask System**
  - Parent-child task relationship with cascading state rules (closing all subtasks prompts parent closure).
- [ ] **B18.3: Story Points & Estimation**
  - Fibonacci/T-Shirt size estimation field on tasks with sprint velocity aggregation.

#### 🎨 Agent: OpenCode (Frontend)
- [ ] **F18.1: Epic Roadmap & Timeline View**
  - Gantt/Roadmap timeline view showing active epics and milestones.
- [ ] **F18.2: Subtask Checklist Component**
  - Inline subtask creation, completion checkboxes, and progress bar inside task cards & detail panel.
- [ ] **F18.3: Story Point Badges & Board Estimator**
  - Story point input modal, column estimate totals, and sprint capacity meter.

---

### 🐙 Sprint 19 — GitHub Integration & Webhook Delivery Engine

**Goal:** Turn DevFlow into the central source of truth for software engineers with automatic Git syncing.

#### 🤖 Agent: Codebuff (Backend)
- [ ] **B19.1: GitHub App Webhook Ingestion**
  - Handle `push`, `pull_request`, `issue` webhooks.
  - Auto-parse task keys (e.g. `DF-104: Fix CORS headers`).
- [ ] **B19.2: Smart Task State Transitions**
  - PR opened $\rightarrow$ Move task to **In Review**.
  - PR merged $\rightarrow$ Move task to **Done** + log Git committer as contributor.
- [ ] **B19.3: Personal Access Tokens (PAT)**
  - Allow CLI tools, GitHub Actions, and bots to query & mutate DevFlow securely.

#### 🎨 Agent: OpenCode (Frontend)
- [ ] **F19.1: GitHub Integration Settings UI**
  - Repository linking, webhook secret management, and branch rule configurations.
- [ ] **F19.2: Git Branch & PR Widget in Task Detail**
  - Show linked branches, open pull requests, CI/CD check status, and direct GitHub links.
- [ ] **F19.3: Personal Access Token Generator**
  - Scoped token creation modal with expiration dates and copyable secrets.

---

### 📈 Sprint 20 — Advanced Agile Analytics & Custom Fields

**Goal:** Enterprise analytics, customizable workflows, and comprehensive team insights.

#### 🤖 Agent: Codebuff (Backend)
- [ ] **B20.1: Agile Analytics Engine**
  - Sprint Burndown snapshot recorder (daily ideal vs actual point burn).
  - Velocity history tracking across past 10 sprints.
  - Cycle Time & Lead Time percentile computation (P50, P90).
- [ ] **B20.2: Custom Fields Engine**
  - Dynamic schemas: Dropdown, Number, Text, User, Date.
  - Value storage with strict type validation per workspace.
- [ ] **B20.3: Sprint Rollover Automation**
  - On sprint complete: automatically roll unfinished tasks to next planned sprint or backlog.

#### 🎨 Agent: OpenCode (Frontend)
- [ ] **F20.1: Interactive Burndown & Velocity Charts**
  - Zoomable SVG/Canvas charts with confidence bands and export to PNG/CSV.
- [ ] **F20.2: Team Performance & Lead Time Dashboard**
  - Cumulative Flow Diagram (CFD) and bottleneck heatmaps.
- [ ] **F20.3: Custom Field Builder & Card Renderer**
  - Settings page custom field builder + dynamic form fields on Kanban cards & detail drawers.

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

*DevFlow Architecture Team — Updated 2026-08-23*

