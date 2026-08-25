# DevFlow E2E Tests

Playwright smoke tests that sweep every major page and fail on any console
error, uncaught exception, or unexpected API error. No mocks — they run against
the **real local stack** (Postgres + Redis + API) via the Vite dev proxy.

## What it covers

- Login flow (real form, real credentials)
- 16 page-load smoke tests: Dashboard, Board, Sprint planning, My tasks,
  Search, Reports, Epics, Labels, Custom fields, Activities, Notifications,
  Settings, Project settings, Webhooks, GitHub integration, Templates
- Every test subscribes to `console.error`, `pageerror`, and 4xx/5xx API
  responses and asserts none are unexpected (401 on `/auth/me` + `/hubs/` and
  404 on `/reporting/` are treated as benign).

## Prerequisites

1. **Docker** — `docker compose up -d` (postgres, redis, api). The API container
   runs migrations on startup.
2. **Frontend dev server** — `cd frontend && npm run dev` (the Playwright
   `webServer` config will auto-start it if not running; it proxies `/api` to
   `http://localhost:5217`).
3. **Backend dev server on 5217** — the Vite proxy points at the dev backend,
   **not** the Docker container (which is on 8080). Start it once:
   ```bash
   cd src/DevFlow.Api
   ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5217
   ```
4. **Playwright browsers** — `npx playwright install chromium`

## Run

From the repo root:

```bash
npm run e2e            # full suite
npm run e2e -- --debug # interactive UI
npx playwright test --config e2e/playwright.config.ts --grep "Board"
```

## Test user

The suite auto-registers `e2e@devflow.test` / `E2ePass!123` if it doesn't
exist, then creates (or reuses) workspace `E2E Test Workspace` + project
`E2E Test Project`. Re-running is idempotent.

## Debugging a failure

Screenshots + error context land in `test-results/`. Run with `--trace on` to
capture a trace you can replay in `npx playwright show-trace`.
