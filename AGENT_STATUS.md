# AGENT STATUS — Sprint 7+ Improvement Plan

## 📊 Current Project Analysis

### ✅ What Works (6 sprints, 12 features)
| Category | Features |
|----------|----------|
| **Core** | Auth, Workspaces, Projects, Tasks, Sprints |
| **Board** | Kanban drag-drop, Task detail panel, Comments |
| **Realtime** | SignalR live updates |
| **Notifications** | In-app notifications, Activity log |
| **Search** | Global search (Ctrl+K) |
| **Settings** | Profile, Theme, Mobile nav |
| **Dashboard** | Basic stats, Activity feed |
| **Labels** | CRUD + assign to tasks |

### ❌ What's Missing (Real Business Value)
| Gap | Impact | Why It Matters |
|-----|--------|----------------|
| **No task dependencies** | 🔴 High | Can't show blockers or critical path |
| **No time tracking** | 🔴 High | Teams need estimate vs actual |
| **No custom fields** | 🟡 Medium | Every team has unique metadata |
| **No email notifications** | 🔴 High | Can't notify offline users |
| **No GitHub integration** | 🟡 Medium | Dev teams need PR linking |
| **No reporting** | 🔴 High | No burndown, velocity, metrics |
| **No bulk operations** | 🟡 Medium | Slow to manage many tasks |
| **No task templates** | 🟢 Low | Repetitive task creation |
| **No keyboard shortcuts** | 🟡 Medium | Power users need speed |

---

## 🎯 Sprint 7 — Task Intelligence (High Impact)

### Agent: Codebuff (Backend)

#### B1: Task Dependencies
- [ ] Create `TaskDependency` entity (Blocker → Blocked relationship)
- [ ] Add `GET /tasks/{id}/dependencies` endpoint
- [ ] Add `POST /tasks/{id}/dependencies` (add blocker)
- [ ] Add `DELETE /tasks/{id}/dependencies/{depId}` (remove blocker)
- [ ] Prevent status change if task is blocked
- [ ] Add `GET /projects/{id}/critical-path` endpoint

#### B2: Time Tracking
- [ ] Create `TimeEntry` entity (taskId, userId, minutes, description, date)
- [ ] Add `GET /tasks/{id}/time-entries` endpoint
- [ ] Add `POST /tasks/{id}/time-entries` (log time)
- [ ] Add `DELETE /time-entries/{id}` (remove entry)
- [ ] Add `estimateMinutes` field to TaskItem
- [ ] Add `totalLoggedMinutes` to task response

#### B3: Advanced Filtering API
- [ ] Extend task list endpoint with filters: `assigneeId`, `priority`, `labelIds`, `dueBefore`, `dueAfter`, `blocked`
- [ ] Add `GET /projects/{id}/labels/count` for label usage stats
- [ ] Add sorting options: `sortBy=dueDate|priority|created|updated`

### Agent: OpenCode (Frontend)

#### F1: Task Dependencies UI
- [ ] Show blocked/blocking indicators on task cards
- [ ] Add "Blocked by" section in TaskDetailPanel
- [ ] Add dependency picker (search tasks to link)
- [ ] Visual blocker warning when trying to move blocked task

#### F2: Time Tracking UI
- [ ] Add "Time" tab in TaskDetailPanel
- [ ] Time entry form (hours, description)
- [ ] Show total logged vs estimate progress bar
- [ ] Timer button (start/stop tracking)

#### F3: Enhanced Board Filters
- [ ] Filter bar with assignee dropdown, priority, labels
- [ ] Filter by due date range
- [ ] Show "blocked" badge on filtered tasks
- [ ] Save filter presets

---

## 🎯 Sprint 8 — Reporting & Integration

### Agent: Codebuff (Backend)

#### B1: Reporting API
- [ ] `GET /projects/{id}/burndown?startDate=&endDate=` — daily remaining points
- [ ] `GET /projects/{id}/velocity` — story points per sprint
- [ ] `GET /projects/{id}/report` — completion rate, avg cycle time
- [ ] `GET /workspaces/{id}/team-report` — per-member stats

#### B2: GitHub Integration
- [ ] `POST /projects/{id}/github/link` — connect GitHub repo
- [ ] `GET /projects/{id}/github/prs` — list open PRs
- [ ] Webhook handler for PR events (auto-link to tasks via regex)
- [ ] Add `githubUrl` field to TaskItem

#### B3: Email Notifications
- [ ] Add SendGrid/Resend integration
- [ ] Send email on: task assigned, mentioned in comment, sprint started
- [ ] User email preferences (opt-in/out per event type)
- [ ] Queue-based background processing

### Agent: OpenCode (Frontend)

#### F1: Burndown Chart
- [ ] Canvas/SVG burndown chart component
- [ ] Show ideal vs actual line
- [ ] Tooltip with daily details

#### F2: Velocity Chart
- [ ] Bar chart showing points completed per sprint
- [ ] Trend line

#### F3: GitHub Integration UI
- [ ] Link repo in project settings
- [ ] Show linked PRs on task detail
- [ ] PR status badges (open/merged/closed)

---

## 🎯 Sprint 9 — Power Features

### Both Agents

#### Bulk Operations
- [ ] Multi-select tasks (checkbox)
- [ ] Bulk move, assign, label, delete
- [ ] Keyboard shortcuts (Ctrl+A, Delete, etc.)

#### Task Templates
- [ ] Create template from existing task
- [ ] Template library per project
- [ ] One-click template apply

#### Custom Fields
- [ ] Define custom fields per project (text, number, date, select)
- [ ] Show on task cards and detail panel
- [ ] Filter by custom fields

---

## 📋 Priority Order

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| 🔴 P0 | Task Dependencies | 2 sprints | Blockers, critical path |
| 🔴 P0 | Time Tracking | 1 sprint | Estimate vs actual |
| 🔴 P0 | Reporting | 1 sprint | Burndown, velocity |
| 🟡 P1 | GitHub Integration | 1 sprint | Dev workflow |
| 🟡 P1 | Email Notifications | 1 sprint | Offline alerts |
| 🟡 P1 | Bulk Operations | 0.5 sprint | Productivity |
| 🟢 P2 | Custom Fields | 1 sprint | Flexibility |
| 🟢 P2 | Task Templates | 0.5 sprint | Speed |

---

## 🔄 How We Work

### Branch Strategy
- **Codebuff**: `feat/backend-*` branch
- **OpenCode**: `feat/frontend-*` branch (via worktree)

### Communication
- **AGENT_STATUS.md** — shared status file
- Both agents update status after each task

### CI/CD
- Each PR runs: Build → Test → Deploy Preview
- Auto-merge when CI passes

### Sprint Cycle
1. Plan (10 min) — Codebuff writes plan to AGENT_STATUS.md
2. Execute (parallel) — Both agents work simultaneously
3. Review (5 min) — Check CI, fix issues
4. Deploy (2 min) — Merge to main, verify production

---

*Last updated: Sprint 7 planning*
