# DevFlow

> A project management platform for developers — a Jira/Linear clone built with ASP.NET Core and React.

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
| Testing | xUnit (50 unit tests) |
| DevOps | Docker Compose, GitHub Actions |

**Frontend**

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 with a generated design system |
| Routing | React Router v7 |
| Drag & drop | Native HTML5 DnD (no library) |

## Features

- JWT auth with silent refresh — page reloads keep you signed in
- Workspaces with role-based access (Owner / Admin / Member) enforced server-side
- Projects with keys, archive lifecycle
- Kanban board: drag cards between Backlog → In Progress → In Review → Done
- Realtime boards via SignalR — changes made by teammates appear instantly
- Task detail panel with comments thread
- Sprints API with single-active-sprint invariant per project
- Declarative authorization via pipeline behavior (`[RequireWorkspaceRole]`)

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
- [ ] Realtime updates (SignalR)
- [ ] Notifications & Activity Log
- [ ] File Upload
- [ ] Redis caching layer
- [ ] Integration tests with Testcontainers
- [ ] Sprint planning UI
