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
- Projects with keys, archive lifecycle, and project-level member RBAC
- Kanban board: drag cards between Backlog → In Progress → In Review → Done, with assignee/epic swimlanes
- Realtime boards via SignalR — changes made by teammates appear instantly
- Task detail panel with comments thread, watchers, and attachments
- Sprints API with single-active-sprint invariant per project
- Declarative authorization via pipeline behavior (`[RequireWorkspaceRole]`)

### Task Intelligence
- **Task Dependencies** — block tasks with blockers (project-wide dependency graph, blocked-state badges on the board), plus epic-to-epic dependencies
- **AI Agent** — real LLM planning (provider-agnostic: OpenAI, LiteLLM, Ollama, …) with knowledge-gated prompts and per-project self-approval
- **Time Tracking** — log time on tasks, story-point estimates vs actual
- **Labels & Custom Fields** — color-coded labels, typed custom fields (text/number/date/select)
- **Task Templates & Bulk Operations** — reusable templates, import/export (JSON/CSV/XLSX)

### Collaboration
- **Notifications** — in-app + email preferences, real-time updates
- **Activity Log** — track all changes across projects
- **Knowledge Base** — ADR / Pattern / Runbook entries with lifecycle, auto-captured when tasks ship
- **Search** — global search (Ctrl+K) across tasks, projects, epics, labels, users, comments; saved searches
- **GitHub Integration** — repo linking, PR tracking, webhooks with dead-letter queue (admin inspect/replay)

### Analytics
- **Burndown Charts** — sprint progress at a glance
- **Velocity Metrics** — completion rates across sprints
- **Team Report** — per-member stats, cycle/lead-time percentiles

### UI/UX
- **Dark/Light Theme** — toggle with persistent preference
- **Mobile Navigation** — responsive sidebar with bottom bar
- **Settings** — profile, appearance, notification preferences
- **Workspace/Project Branding** — emoji logos, project cover gradients

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

## Documentation

- [Development guide](docs/development.md) — setup, testing, migrations, conventions
- [Architecture](docs/architecture.md) — solution layout, CQRS pipeline, data flow
- [API guide](docs/api.md) — REST API, auth, and production endpoints
- [Design system](design-system/devflow/MASTER.md) — tokens, colors, typography
- [Agent guidelines](AGENTS.md) — how AI agents coordinate on this repo

## Roadmap

- [x] Solution setup with Clean Architecture
- [x] Docker Compose (Postgres + Redis)
- [x] Health checks, structured logging (Serilog)
- [x] Authentication (JWT + Refresh Token), Google OAuth
- [x] Role-Based Authorization (workspace + project level)
- [x] Workspace / Project / Sprint / Kanban Board & Tasks
- [x] Comments, Realtime updates (SignalR), Notifications & Activity Log
- [x] File & Attachment Upload (size + type safety)
- [x] Redis caching layer
- [x] Integration tests with Testcontainers
- [x] Sprint planning UI, Burndown Charts, Velocity Metrics
- [x] Task Dependencies, Time Tracking, Labels, Custom Fields
- [x] GitHub Integration, Email Notifications
- [x] Bulk Operations, Task Templates, Import/Export
- [x] Webhook Dead-Letter Queue (admin retry)
- [x] Saved Searches, My Tasks (cross-project)
- [x] Board Swimlanes (assignee / epic)
- [x] Knowledge Base (Wiki / ADR / Runbook + auto-capture)
- [x] AI Agent (real LLM planning + self-approval)
- [ ] Public roadmap / changelog page
