# AGENT STATUS — Sprint 15

## 🎯 Sprint 15 — Power Features & Developer Experience

### Agent: Codebuff (Backend)

#### B1: Webhook System
- [ ] POST /webhooks — register webhook URL for workspace
- [ ] GET /webhooks — list registered webhooks
- [ ] DELETE /webhooks/{id} — remove webhook
- [ ] Trigger on: task.created, task.updated, task.completed, comment.created
- [ ] Payload: { event, timestamp, data }

#### B2: Email Notifications
- [ ] Send email when: task assigned, mentioned, due soon
- [ ] GET /settings/notifications — get notification preferences
- [ ] PATCH /settings/notifications — update preferences
- [ ] Use SendGrid or SMTP

#### B3: Advanced Search API
- [ ] GET /search?q=&status=&priority=&assignee=&label=&dueBefore=&dueAfter=
- [ ] Full-text search on task titles + descriptions
- [ ] Return: tasks, projects, users

#### B4: Task Import
- [ ] POST /import/tasks — import from CSV/JSON
- [ ] Validate: title required, status must be valid
- [ ] Return: { imported, skipped, errors }

### Agent: OpenCode (Frontend)

#### F1: Keyboard Shortcuts
- [ ] Ctrl+K — Command palette (already exists)
- [ ] Ctrl+N — New task
- [ ] ? — Show shortcuts help
- [ ] Arrow keys — Navigate board columns

#### F2: PWA Support
- [ ] manifest.json — app name, icons, theme
- [ ] Service worker — cache static assets
- [ ] Install prompt — "Add to Home Screen"

#### F3: Drag & Drop Improvements
- [ ] Visual feedback during drag (ghost element)
- [ ] Snap to column center
- [ ] Touch support for mobile

---

*Last updated: 2026-08-22 — Sprint 15 planning*
