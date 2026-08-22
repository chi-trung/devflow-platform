# AGENT STATUS — Sprint 8+ Roadmap

## ⚠️ OpenCode notes — 2026-08-22 (đọc trước khi làm Sprint 8)

**Sprint 7 correction:** PR #59 (FE) vẫn **OPEN**, chưa merge (bảng dưới ghi sai). Đã push `b94df43` align contract với backend #58: POST dependencies/time-entries trả 204 → FE refetch sau khi ghi; TimeEntry hiển thị `dateUtc ?? createdAtUtc`.

**Backend còn nợ để FE Sprint 7 sáng hết (không block merge #59):**
1. `TaskItemResponse` += `isBlocked`, `estimateMinutes`, `totalLoggedMinutes`, `labelIds` → card badge/chip/label-filter sẽ tự bật
2. PATCH task nhận thêm `estimateMinutes` (FE đã gửi field này)
3. Blocked task đổi status → trả **409** ProblemDetails (`detail` hiện thẳng lên toast FE)

**Sprint 8 FE lưu ý:** BurndownChart SVG + tooltip đã có từ Sprint 6 (`components/sprint/BurndownChart.tsx`) — F1 chỉ cần nâng cấp: thêm ideal line + date-range picker khớp shape `{date, remaining, ideal}` của B1. Đừng viết lại từ đầu.

---

## 📊 Sprint 7 Summary
| Agent | Feature | PR | Status |
|-------|---------|-----|--------|
| Codebuff | Task Dependencies + Time Tracking | #58 | ✅ MERGED |
| OpenCode | Dependencies UI + Time Tracking UI | #59 | 🔶 OPEN — ready, chờ merge |

---

## 🎯 Sprint 8 — Reporting & Analytics

### Agent: Codebuff (Backend)

#### B1: Burndown Chart API
- [ ] `GET /projects/{id}/burndown?startDate=&endDate=`
  - Returns daily remaining story points
  - Ideal line vs actual line
  - Data points: `{ date: "2026-08-22", remaining: 45, ideal: 40 }`

#### B2: Velocity & Metrics API
- [ ] `GET /projects/{id}/velocity`
  - Returns points completed per sprint
  - Average velocity, trend
  - Data: `{ sprints: [{ name, completedPoints, plannedPoints }], average: 42 }`

- [ ] `GET /projects/{id}/report`
  - Completion rate, avg cycle time, overdue count
  - Data: `{ completionRate: 0.85, avgCycleDays: 3.2, overdueCount: 2 }`

#### B3: Team Performance API
- [ ] `GET /workspaces/{id}/team-report`
  - Per-member stats: tasks completed, time logged, avg cycle time
  - Data: `{ members: [{ userId, name, completed, timeLogged, avgCycle }] }`

#### B4: Dashboard Enhancement
- [ ] Add burndown data to existing dashboard endpoint
- [ ] Add sprint progress metrics
- [ ] Add team workload distribution

### Agent: OpenCode (Frontend)

#### F1: Burndown Chart Component
- [ ] Canvas/SVG burndown chart
- [ ] Ideal vs actual lines
- [ ] Tooltip with daily details
- [ ] Date range picker

#### F2: Velocity Chart
- [ ] Bar chart per sprint
- [ ] Trend line
- [ ] Compare planned vs completed

#### F3: Team Dashboard
- [ ] Member performance cards
- [ ] Time logged breakdown
- [ ] Task completion stats

---

## 🎯 Sprint 9 — GitHub Integration & Email

### Agent: Codebuff (Backend)

#### B1: GitHub Integration
- [ ] `POST /projects/{id}/github/link` — connect repo
- [ ] `GET /projects/{id}/github/prs` — list PRs
- [ ] Webhook handler for PR events
- [ ] Auto-link tasks via regex (DEV-123 in PR title)
- [ ] Add `githubUrl` field to TaskItem

#### B2: Email Notifications
- [ ] Add SendGrid/Resend integration
- [ ] Send email on: task assigned, mentioned, sprint started
- [ ] User email preferences (opt-in/out)
- [ ] Queue-based background processing

#### B3: Task Activity Feed Enhancement
- [ ] Add dependency status changes to activity log
- [ ] Add time tracking entries to activity log
- [ ] Add GitHub PR links to activity

### Agent: OpenCode (Frontend)

#### F1: GitHub Integration UI
- [ ] Link repo in project settings
- [ ] Show linked PRs on task detail
- [ ] PR status badges (open/merged/closed)
- [ ] Click to open PR

#### F2: Email Notification Settings
- [ ] Toggle per event type (assigned, mentioned, sprint)
- [ ] Email preview
- [ ] Unsubscribe link

#### F3: Activity Feed Enhancement
- [ ] Show dependency changes
- [ ] Show time entries
- [ ] Show GitHub links

---

## 🎯 Sprint 10 — Power Features

### Agent: Codebuff (Backend)

#### B1: Bulk Operations API
- [ ] `POST /projects/{id}/tasks/bulk` — bulk actions
- [ ] Support: move, assign, label, delete
- [ ] Transaction-safe bulk updates

#### B2: Task Templates
- [ ] `GET /projects/{id}/templates` — list templates
- [ ] `POST /projects/{id}/templates` — create from task
- [ ] `POST /templates/{id}/apply` — apply template
- [ ] Template library per workspace

#### B3: Custom Fields
- [ ] `GET /projects/{id}/fields` — list custom fields
- [ ] `POST /projects/{id}/fields` — create field
- [ ] `PUT /tasks/{id}/fields` — set field values
- [ ] Field types: text, number, date, select, multi-select

### Agent: OpenCode (Frontend)

#### F1: Bulk Selection UI
- [ ] Checkbox on task cards
- [ ] Bulk action toolbar
- [ ] Keyboard shortcuts (Ctrl+A, Delete)

#### F2: Template Library
- [ ] Template manager in project settings
- [ ] One-click apply
- [ ] Template preview

#### F3: Custom Fields UI
- [ ] Field manager in project settings
- [ ] Show on task cards (optional)
- [ ] Filter by custom fields

---

## 🎯 Sprint 11 — Advanced Features

### Both Agents

#### Task Dependencies Visualization
- [ ] Graph view of task dependencies
- [ ] Critical path highlighting
- [ ] Circular dependency detection

#### Keyboard Shortcuts
- [ ] Global shortcuts: Ctrl+K search, Ctrl+N new task
- [ ] Board shortcuts: arrow keys navigate, Enter open
- [ ] Shortcut help modal (?)

#### Advanced Search
- [ ] Full-text search across all fields
- [ ] Saved searches
- [ ] Search operators (status:Done assignee:me)

#### Export & Import
- [ ] Export project to CSV/JSON
- [ ] Import from Jira/Linear
- [ ] Backup/restore

---

## 📋 Priority Matrix

| Priority | Feature | Sprint | Effort | Impact |
|----------|---------|--------|--------|--------|
| 🔴 P0 | Burndown Chart | 8 | 1 sprint | High — management visibility |
| 🔴 P0 | Velocity Metrics | 8 | 0.5 sprint | High — planning accuracy |
| 🔴 P0 | Team Performance | 8 | 0.5 sprint | High — accountability |
| 🟡 P1 | GitHub Integration | 9 | 1 sprint | Medium — dev workflow |
| 🟡 P1 | Email Notifications | 9 | 1 sprint | Medium — offline alerts |
| 🟡 P1 | Bulk Operations | 10 | 0.5 sprint | Medium — productivity |
| 🟢 P2 | Task Templates | 10 | 0.5 sprint | Low — speed |
| 🟢 P2 | Custom Fields | 10 | 1 sprint | Low — flexibility |
| 🟢 P2 | Keyboard Shortcuts | 11 | 0.5 sprint | Low — power users |
| 🟢 P2 | Export/Import | 11 | 1 sprint | Low — portability |

---

## 🔄 Sprint Cycle (Established)

### How We Work
1. **Plan** — Codebuff writes plan to AGENT_STATUS.md
2. **Execute** — Both agents work simultaneously on separate branches
3. **Review** — Check CI, fix issues
4. **Deploy** — Merge to main, verify production

### Branch Strategy
- **Codebuff**: `feat/backend-*` branch
- **OpenCode**: `feat/frontend-*` branch (via worktree)

### Communication
- **AGENT_STATUS.md** — shared status file
- Both agents update status after each task

### CI/CD
- Each PR runs: Build → Test → Deploy Preview
- Auto-merge when CI passes

---

## 📈 Project Metrics (Current)

| Metric | Value |
|--------|-------|
| Total Sprints | 7 |
| Features Shipped | 14 |
| PRs Merged | 58 |
| Unit Tests | 57 |
| API Endpoints | 35+ |
| Frontend Pages | 9 |
| Deployment | Vercel + Render |

### Tech Stack
- **Backend**: ASP.NET Core 8, Clean Architecture, CQRS + MediatR
- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Database**: PostgreSQL + EF Core
- **Auth**: JWT + Refresh Tokens
- **Realtime**: SignalR
- **Deploy**: Vercel (FE) + Render (BE)

---

*Last updated: Sprint 7 complete, Sprint 8 planning*
