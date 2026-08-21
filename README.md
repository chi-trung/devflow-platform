# DevFlow

> A project management platform for developers — a Jira/Linear clone built with ASP.NET Core.

[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4)](https://dotnet.microsoft.com/)
[![Status](https://img.shields.io/badge/status-in%20development-orange)]()

## About

DevFlow helps software teams plan sprints, manage tasks on a Kanban board, and ship faster.
Built as a long-term learning project with a strong focus on architecture, testing, and DevOps practices.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | ASP.NET Core 8 Web API |
| Architecture | Clean Architecture, CQRS + MediatR |
| Database | PostgreSQL + EF Core |
| Caching | Redis |
| Realtime | SignalR |
| Background jobs | Hangfire |
| Search | Elasticsearch |
| File storage | MinIO (S3-compatible) |
| Testing | xUnit, Testcontainers |
| DevOps | Docker Compose, GitHub Actions |

## Roadmap

- [x] Solution setup with Clean Architecture
- [x] Docker Compose (Postgres + Redis)
- [x] Health checks, structured logging (Serilog)
- [ ] Authentication (JWT + Refresh Token)
- [ ] Role-Based Authorization
- [ ] Workspace / Project / Sprint
- [ ] Kanban Board & Tasks
- [ ] Comments & Mentions
- [ ] Realtime updates (SignalR)
- [ ] Notifications & Activity Log
- [ ] File Upload
- [ ] Dashboard & Calendar
- [ ] GitHub Integration
- [ ] AI-powered task generation
- [ ] CI/CD pipeline

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Docker](https://www.docker.com/)

### Run with Docker Compose

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| API | http://localhost:8080 |
| Swagger UI | http://localhost:8080/swagger |
| Health checks | http://localhost:8080/health |

### Run locally

```bash
# start infrastructure (postgres + redis)
docker compose up -d postgres redis

# run the api
dotnet run --project src/DevFlow.Api
```

## Project Structure

```
DevFlow/
├── src/
│   ├── DevFlow.Domain          # Enterprise business rules — entities, value objects, result pattern
│   ├── DevFlow.Application     # Application business rules — use cases, CQRS
│   ├── DevFlow.Infrastructure  # External concerns — JWT, Redis, email, file storage
│   └── DevFlow.Api             # Presentation layer — controllers, middleware, health checks
└── tests/
    ├── DevFlow.UnitTests        # Fast, isolated unit tests
    └── DevFlow.IntegrationTests # End-to-end API tests
```

Dependencies point inward: `Api → Infrastructure → Application → Domain`. The domain layer has zero dependencies.
