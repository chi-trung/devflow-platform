# DevFlow

> A project management platform for developers — a Jira/Linear clone built with ASP.NET Core and React. Features real-time collaboration, task dependencies, time tracking, and more.

[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React-19-087EA4)](https://react.dev/)
[![Status](https://img.shields.io/badge/status-in%20development-orange)]()

## About

DevFlow helps software teams plan sprints, manage tasks on a Kanban board, and ship faster.
Built as a long-term learning project with a strong focus on architecture, testing, and DevOps practices.

## Tech Stack

**Backend**

| Layer | Technology |
|---|---|
| Framework | ASP.NET Core 8 Web API |
| Architecture | Clean Architecture, CQRS + MediatR |
| Database | PostgreSQL + EF Core |
| Auth | JWT access tokens + rotating refresh tokens |
| Testing | xUnit (333 unit tests) |
| DevOps | Docker Compose, GitHub Actions |

**Frontend**

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 with a generated design system |
| Routing | React Router v7 |
| Drag & drop | Native HTML5 DnD (no library) |

## Features

### Core
- JWT auth with silent refresh — page reloads keep you signed in
- Workspaces with role-based access (Owner / Admin / Member) enforced server-side
- Projects with keys, archive lifecycle
- Kanban board: drag cards between Backlog → In Progress → In Review → Done
- Realtime boards via SignalR — changes made by teammates appear instantly
- Task detail panel with comments thread
- Sprints API with single-active-sprint invariant per project
- Declarative authorization via pipeline behavior (`[RequireWorkspaceRole]`)

### Task Intelligence
- **Task Dependencies** — Block tasks with blockers, prevent status change
- **Time Tracking** — Log time on tasks, estimate vs actual
- **Labels** — Color-coded labels for task categorization

### Collaboration
- **Notifications** — In-app notifications with real-time updates
- **Activity Log** — Track all changes across projects
- **Comments** — Threaded discussions on tasks
- **Search** — Global search (Ctrl+K) across tasks and projects

### UI/UX
- **Dark/Light Theme** — Toggle with persistent preference
- **Mobile Navigation** — Responsive sidebar with bottom bar
- **Settings** — Profile, appearance, notification preferences

## Quick Start

### Backend

```bash
docker compose up -d          # Postgres + Redis
dotnet run --project src/DevFlow.Api
# API on http://localhost:5217, Swagger UI included
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000, proxies /api to :5217
```

## Roadmap

- [x] Solution setup with Clean Architecture
- [x] Docker Compose (Postgres + Redis)
- [x] Health checks, structured logging (Serilog)
- [x] Authentication (JWT + Refresh Token)
- [x] Role-Based Authorization
- [x] Workspace / Project / Sprint
- [x] Kanban Board & Tasks
- [x] Comments
- [x] Realtime updates (SignalR)
- [x] Notifications & Activity Log
- [x] File Upload
- [x] Redis caching layer
- [x] Integration tests with Testcontainers
- [x] Sprint planning UI
- [x] Task Dependencies
- [x] Time Tracking
- [x] Labels
- [x] Notifications
- [x] Activity Log
- [x] Search
- [x] Settings
- [x] Mobile Navigation
- [x] Burndown Charts
- [x] Velocity Metrics
- [x] GitHub Integration
- [x] Email Notifications
- [x] Bulk Operations
- [x] Task Templates
- [x] Custom Fields
- [x] Attachment Upload (size + type safety)
- [x] Webhook Dead-Letter Queue (admin retry)
- [x] Project Import / Export
- [x] Google OAuth
- [x] Saved Searches
- [x] My Tasks (cross-project)

### Sprint 30
- [x] Watcher list UI (who is watching a task) — backend `GET /tasks/{id}/watchers` + frontend panel
- [x] Webhook DLQ admin UI (inspect + replay) — Admin-gated on Webhooks page
- [x] Integration test expansion (project → sprint → task flow) — shared DB collection fixture
- [x] EmptyState component adoption in top pages (Activities, Board, CustomFields, GitHub, MyTasks)

### Sprint 31
- [x] Project-level member management / RBAC — `ProjectMember` entity + member CRUD endpoints + Manager-gated UI
- [x] Outbox DLQ admin batch — Replay-all / Purge buttons on Webhooks page
- [x] Epic-to-epic dependencies — backend CQRS + frontend "Blocked by" section
- [x] EmptyState adoption across remaining pages (dashboard cards, epics, webhooks, import/export, ...)
- [x] Project authorization guard (`ProjectAuthorizationBehavior`) — project-scoped RBAC pipeline

### Sprint 32 — Visual Identity & Product Polish (De-AI-fy)
- [x] Dashboard time-of-day greeting + reusable `Logo`/`BrandMark` brand mark
- [x] Workspace emoji + Project emoji/coverColor — additive nullable fields + pickers
- [x] `TaskItemResponse.AttachmentSummary` — count + up to 3 image previews (batch query)
- [x] EmptyState illustration system — 6 theme-aware SVG scenes applied across pages
- [x] AuthLayout hero illustration (kanban scene) + `Logo` adoption
- [x] Emoji logo UI — sidebar, command palette, workspace header, project cards
- [x] Project cover gradients — palette-keyed banners on cards + board header
- [x] Micro-animations — hover-lift, fade-in, rise utilities
- [x] Avatar presence dots on the board (from `usePresence`)
- [x] Attachment image thumbnails on task cards + detail panel (fetch→blob→objectURL)

### Next up — Sprint 33
- Component library catalog / design sync
- tsvector search ranking (beyond ILIKE)
- Time-tracking reporting (`GetTeamReportTrends` placeholder)
- Custom field grouping UI
