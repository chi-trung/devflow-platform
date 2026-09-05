# DevFlow Architecture

A high-level map of how the codebase fits together. For API usage see
[api.md](api.md); for setup instructions see [development.md](development.md).

## Solution layout

```
DevFlow.sln
├── src/
│   ├── DevFlow.Domain/          Entities, enums, domain logic (no dependencies)
│   ├── DevFlow.Application/     CQRS features, behaviors, interfaces
│   ├── DevFlow.Infrastructure/  EF Core, Redis, JWT, email, outbox, AI client
│   └── DevFlow.Api/             Controllers, SignalR hubs, middleware
├── frontend/                    React 19 + TypeScript SPA
├── tests/
│   ├── DevFlow.UnitTests/       xUnit — domain, handlers, behaviors
│   └── DevFlow.IntegrationTests/ WebApplicationFactory + Testcontainers Postgres
└── e2e/                         Playwright smoke tests
```

Dependencies point inward only: `Api → Application/Infrastructure → Domain`.
Domain references nothing.

## Backend — Clean Architecture + CQRS

Every use case is a MediatR request. A typical feature lives in
`src/DevFlow.Application/Features/<Area>/`:

- `<Command|Query>.cs` — the request + response records
- `<Command|Query>Handler.cs` — the logic

Cross-cutting concerns run as MediatR pipeline behaviors
(`src/DevFlow.Application/Common/Behaviors/`):

| Behavior | Responsibility |
|---|---|
| `ValidationBehavior` | FluentValidation-style request validation |
| `WorkspaceAuthorizationBehavior` | `[RequireWorkspaceRole]` enforcement (workspace-scoped requests) |
| `ProjectAuthorizationBehavior` | project-scoped RBAC (project members, Manager+ gates) |
| `ActivityBehavior` | records activity-log entries from `I*Event` notifications |
| `NotificationBehavior` | turns `INotificationEvent` into in-app/email notifications |
| `RealtimeBehavior` | pushes SignalR events from `IWorkspaceEvent`/`IProjectEvent` |
| `CacheInvalidationBehavior` | invalidates Redis caches tagged to mutated entities |
| `LoggingBehavior` | structured request/response logging |

Controllers (`src/DevFlow.Api/Controllers/`) are thin: bind the request, call
`sender.Send(...)`, map the result. Request DTOs live in `src/DevFlow.Api/Contracts/`.

### Key infrastructure pieces

- **Persistence** — EF Core + PostgreSQL. Entities under `DevFlow.Domain/Entities/`.
- **Caching** — Redis layer in front of hot list queries; invalidation is
  declarative via the behavior above.
- **Outbox** — `IOutboxDispatcher` + `OutboxProcessor` (hosted service) deliver
  webhooks/email reliably; failed deliveries land in a dead-letter queue
  (admin can inspect/replay, see the Webhooks page).
- **Realtime** — two SignalR hubs: `/hubs/projects` (board/task changes) and
  `/hubs/notifications` (user notifications).
- **Auth** — JWT access tokens (15 min) + rotating refresh tokens; Google
  OAuth optional; personal access tokens (`df_...`) for scripts — handled by
  the PAT auth handler + scope middleware.
- **AI** — provider-agnostic `IAiClient` (`Infrastructure/AI/`). Configure via
  `Ai__ApiKey` / `Ai__Model`; empty key disables AI features.

## Frontend

React 19 + TypeScript (strict) + Vite + Tailwind v4.

```
frontend/src/
├── App.tsx          route table (React Router v7)
├── pages/           route-level components (one per screen)
├── components/      shared UI + feature folders (board/, dashboard/, ui/…)
├── hooks/           custom hooks (useApi, usePresence, …)
├── auth/            auth context, RequireAuth guard
├── lib/api.ts       single typed API client (all fetches go through here)
├── lib/             formatters, dashboard derivation, i18n helpers
├── types/api.ts     response/request types mirroring the backend contracts
└── i18n/            en.json + vi.json (react-i18next)
```

Conventions worth knowing before editing:

- **Types must mirror the backend records exactly.** `types/api.ts` was swept
  against the C# response records — every field there is real. When changing a
  backend response, update both sides in the same PR.
- **All HTTP traffic goes through `lib/api.ts`** (auth headers, refresh flow,
  error shaping). Pages never call `fetch` directly.
- **Board filters/presets** persist to `localStorage` per project.
- Tests: Vitest (`npm test`), colocated under `__tests__/`.

## Data flow example: moving a task on the board

1. Drop card → `BoardPage.moveTask` → `updateTaskStatus` in `lib/api.ts`
2. `PATCH /tasks/{id}` → `TasksController` → `UpdateTaskItemCommand`
3. Pipeline: validation → workspace/project authorization → handler
4. Handler persists, raises `TaskStatusChangedEvent`
5. Behaviors fan out: activity log entry, notifications to watchers/assignee,
   SignalR push via `ProjectHub` → other clients' boards update instantly

## Testing strategy

| Layer | Tool | What's covered |
|---|---|---|
| Domain/handler unit tests | xUnit (src/DevFlow.UnitTests) | entities, CQRS handlers, behaviors |
| Integration tests | xUnit + Testcontainers Postgres | API endpoints against a real database |
| Frontend unit tests | Vitest | lib/ helpers, components |
| E2E smoke | Playwright | login → board flow |

CI (`.github/workflows/ci.yml`) runs backend build+test and frontend
build+test on every push/PR.

## Deployment

| Piece | Host | Trigger |
|---|---|---|
| Frontend | Vercel | auto-deploy on push to `main` |
| Backend | Render | `deploy-render.yml` webhook workflow |
| Database backups | GitHub Actions | `backup.yml` (scheduled, uses `scripts/backup-db.sh`) |
| Keep-alive | GitHub Actions | `keep-alive.yml` (pings Render free tier) |
