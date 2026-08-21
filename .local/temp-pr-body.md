## Description

Adds robust integration test coverage for the API using `WebApplicationFactory`, `Testcontainers.PostgreSql` (for true Postgres testing in CI), and an intelligent EF InMemory fallback (allowing local test runs without requiring a local Docker daemon).

## What's inside

- **Test Infrastructure**: `DevFlowWebApplicationFactory` spins up a Postgres container via Testcontainers when Docker is active, or falls back gracefully to EF Core InMemory database when offline.
- **Integration Tests**: `AuthAndWorkspaceIntegrationTests` tests the full auth registration, login, JWT token generation, workspace creation, and workspace listing flow end-to-end.
- **API Robustness**: Guarded startup migrations in `Program.cs` to support non-relational providers (`EnsureCreated()` vs `Migrate()`).

## Type of change

- [x] Test / Infrastructure

## Checklist

- [x] Unit tests (57/57) pass
- [x] Integration test passes successfully
