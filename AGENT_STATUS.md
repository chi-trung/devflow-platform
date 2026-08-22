# AGENT STATUS — Sprint 12 Plan

## 🎯 Sprint 12 — UX Polish & Real-time

### Agent: Codebuff (Backend)

#### B1: Real-time Notifications via SignalR
- [ ] Create NotificationHub for push notifications
- [ ] Notify user when: task assigned, mentioned, sprint started
- [ ] Frontend auto-receives notification without polling

#### B2: Task Comments with @Mentions
- [ ] Parse @username in comment content
- [ ] Create notification for mentioned users
- [ ] GET /users/search?q= for mention autocomplete

#### B3: Task Activity Improvements
- [ ] Log: dependency added/removed
- [ ] Log: time entry added/removed
- [ ] Log: label added/removed

### Agent: OpenCode (Frontend)

#### F1: Keyboard Shortcuts
- [ ] N — New task (when on board)
- [ ] E — Edit task (when task selected)
- [ ] ? — Show shortcuts help modal

#### F2: @Mention in Comments
- [ ] Type @ in comment box → show user dropdown
- [ ] Autocomplete username
- [ ] Highlight mentions in comment display

#### F3: Notification Push
- [ ] Connect to SignalR NotificationHub
- [ ] Show toast when new notification arrives
- [ ] Update bell badge in real-time

---

## 🎯 Sprint 13 — Advanced Analytics

### Codebuff
- [ ] Sprint Report API
- [ ] Cumulative Flow Diagram API
- [ ] Workload Distribution API

### OpenCode
- [ ] Cumulative Flow Chart (stacked area)
- [ ] Sprint Report Page
- [ ] Workload Heatmap

---

## 🎯 Sprint 14 — Developer Experience

### Codebuff
- [ ] Webhook System
- [ ] API Versioning
- [ ] Rate Limiting Improvements

### OpenCode
- [ ] Drag & Drop Improvements
- [ ] Infinite Scroll
- [ ] PWA Support

---

*Last updated: Sprint 12 planning*
