# Development Guide

Everything you need to run DevFlow locally and work on it day-to-day.
Architecture overview: [architecture.md](architecture.md). API usage:
[api.md](api.md).

## Prerequisites

| Tool | Version | Used for |
|---|---|---|
| .NET SDK | 8.x | backend |
| Node.js | 20+ | frontend, e2e |
| Docker | any recent | local Postgres + Redis |
| Playwright browsers | installed via `npx playwright install` | e2e (optional) |

## Quick start

```bash
# 1. Infrastructure (Postgres + Redis)
docker compose up -d postgres redis

# 2. Backend — API on http://localhost:5217 (Swagger at /swagger)
dotnet run --project src/DevFlow.Api

# 3. Frontend — http://localhost:3000, proxies /api to :5217
cd frontend
npm install
npm run dev
```

Or run everything containerized: `docker compose up -d` (adds the `api`
service on port 8080).

### Configuration

Copy [.env.example](../.env.example) to `.env` for docker compose. For running
the API directly, set `Jwt__Key` (required outside Development — generate with
`openssl rand -base64 64`) and optionally `OAuth__GoogleClientId/Secret`,
`Ai__ApiKey`, `Ai__Model`. Every appsettings section can be overridden with
the `Section__Key` environment-variable shape.

## Testing

```bash
# Backend — unit tests (fast, no Docker needed)
dotnet test tests/DevFlow.UnitTests

# Backend — integration tests (needs Docker for Testcontainers Postgres;
# falls back to EF InMemory when Docker is unavailable)
dotnet test tests/DevFlow.IntegrationTests

# Frontend — Vitest
cd frontend && npm test

# Frontend — type check (CI runs this before tests)
cd frontend && npx tsc -b

# E2E smoke (frontend dev server + API must be running)
npm run e2e          # from repo root
```

## Database migrations

Migrations live in `DevFlow.Infrastructure/Persistence/Migrations`.

```bash
dotnet ef migrations add <Name> \
  --project src/DevFlow.Infrastructure \
  --startup-project src/DevFlow.Api

dotnet ef database update \
  --project src/DevFlow.Infrastructure \
  --startup-project src/DevFlow.Api
```

## Working with the frontend

- **API client** — all requests go through `frontend/src/lib/api.ts`. Add new
  endpoints there; pages import the typed functions.
- **Types** — `frontend/src/types/api.ts` mirrors the backend response records
  1:1. When you change a backend response shape, update both sides in the same
  PR and run `npx tsc -b` to catch consumers.
- **i18n** — user-facing strings live in `frontend/src/i18n/en.json` and
  `vi.json`. Add both or CI's test suite will flag the drift.
- **Styling** — Tailwind v4 with the project's design tokens; see
  [design-system/devflow/MASTER.md](../design-system/devflow/MASTER.md) for
  the token reference.

## Working with the backend

- **New use case** — create a request/response record + handler under
  `src/DevFlow.Application/Features/<Area>/`, then a thin controller action in
  `src/DevFlow.Api/Controllers/`. Authorization is declarative: put
  `[RequireWorkspaceRole(Role.Admin)]` on the request record.
- **Domain events** — raise `INotificationEvent`/`IWorkspaceEvent`/`IProjectEvent`
  from handlers; the pipeline behaviors fan out activity log, notifications,
  and realtime pushes automatically.
- **Reliable delivery** — webhooks and emails go through the outbox
  (`Infrastructure/Outbox/`); failed sends are retried and eventually parked in
  the dead-letter queue (Webhooks page, admin only).

## Branching & commits

- `main` is protected — CI must pass (backend `CI` + `Frontend Build & Test`).
- Branch prefixes used by this repo's tooling: `feat/backend-*` (src/),
  `feat/frontend-*` (frontend/). Anything descriptive works for human branches.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `perf:`…).

## Troubleshooting

| Symptom | Fix |
|---|---|
| API starts then 500s on `Jwt` | `Jwt__Key` unset — set it (any base64 string in Development) |
| Frontend 401 loop | API not running or `VITE_API_URL` stale build — restart `npm run dev` |
| Integration tests fail to start Docker | install/start Docker Desktop, or accept the InMemory fallback |
| `curl` to localhost API returns 404 | check the route prefix `/api/v1/...` |
| SignalR doesn't connect locally | ensure you hit the app via `localhost:3000` (the Vite proxy), not the raw API origin |
