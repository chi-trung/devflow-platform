# AGENT STATUS — Sprint 13 Plan

## 🎯 Sprint 13 — Final Polish & Production Readiness

### Current Status (2026-08-22)
- **Backend**: Sprint 8-12 APIs all merged (55+ endpoints)
- **Frontend**: Sprint 8-11 UI merged, i18n partially applied
- **Deploy**: Vercel (FE) + Render (BE) — both live
- **Known issues**: @Mention parsing not wired, notification broadcaster not called, bundle too large (582KB)

---

### Agent: Codebuff (Backend) — Branch: `feat/backend-sprint13`

#### B1: Wire Up @Mention Notifications ⚠️ CRITICAL
- [ ] In `CreateCommentHandler` — parse `@username` in comment content
- [ ] For each mention → create Notification (type=Mention) + call `INotificationBroadcaster`
- [ ] Verify: comment "hey @user" creates a notification + real-time push

#### B2: Activity Log Improvements
- [ ] Log dependency added/removed events
- [ ] Log time entry added/removed events
- [ ] Log label added/removed events
- [ ] Log template applied events

#### B3: User Search Improvements
- [ ] GET /users/search — return avatar URL + role in response
- [ ] Add debounced search support (min 2 chars)

#### B4: Dashboard Improvements
- [ ] Add upcoming deadlines to /dashboard response (with project info)
- [ ] Add per-project task counts to /dashboard response

---

### Agent: OpenCode (Frontend) — Branch: `feat/frontend-sprint13`

#### F1: Finish i18n for Remaining Pages 🔴 HIGH
- [ ] BoardPage — all hardcoded strings (columns, bulk actions, empty states)
- [ ] WorkspacePage — project creation, member management, delete
- [ ] SprintPlanningPage — sprint creation, drag/drop labels
- [ ] ReportsPage — chart titles, date labels
- [ ] TaskDetailPanel — status/priority labels, comment section

#### F2: Code Splitting (Bundle Optimization) 🔴 HIGH
- [ ] Lazy load Routes (Dashboard, Board, Sprint, Reports, Settings, Profile)
- [ ] Lazy load heavy components (GraphModal, BurndownChart, VelocityChart)
- [ ] Target: bundle < 200KB gzipped

#### F3: UX Bug Fixes
- [ ] Notification bell — persist toggle state to API (not just localStorage)
- [ ] Board empty state — show "Create first project" when no projects exist
- [ ] Workspace page — show loading skeleton while stats load
- [ ] Sprint page — fix "No tasks yet" message to link to board correctly

---

### Sprint 13 Success Criteria
| Metric | Target |
|--------|--------|
| @Mention notifications | Working end-to-end |
| i18n coverage | 100% of UI strings |
| Bundle size | < 200KB gzipped |
| Activity log events | 10+ event types tracked |
| Bug fixes | 4+ UX issues resolved |

---

### How to Start

**Paste into Codebuff terminal:**
```
/ask Read AGENT_STATUS.md — Sprint 13 plan. Start with B1: Wire up @Mention notifications in CreateCommentHandler. Parse @username in comment content, create Notification + call INotificationBroadcaster. Branch: feat/backend-sprint13
```

**Paste into OpenCode terminal:**
```
/ask Read AGENT_STATUS.md — Sprint 13 plan. Start with F1: Finish i18n for remaining pages. Begin with BoardPage.tsx — replace all hardcoded strings with useTranslation(). Branch: feat/frontend-sprint13. Worktree: Desktop/devflow-frontend
```

---

*Last updated: 2026-08-22 — Sprint 13 planning*
