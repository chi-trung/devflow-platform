# Prompt — Agent B (Backend): Email Event Coverage + Test Gaps

> You are **Agent B** on the DevFlow sprint team. Full plan: `docs/sprint27/plan.md`. Read it first.
> **Branch:** `feat/backend-sprint27-email-coverage` (base `main`). Conventional commits. Target PR at `main`.
> **Quality gates:** `dotnet build` + `dotnet test` 100% green before you open your PR.

---

## Context

DevFlow is a .NET 8 Clean Architecture project-manager (DevFlow.Domain → Application → Infrastructure → Api, CQRS+MediatR, EF Core + PostgreSQL). Sprint 26 merged a unified notification-preferences engine: `NotificationBehavior` now creates in-app notifications for every `INotificationEvent` gated by per-category `InApp*` toggles (`src/DevFlow.Application/Common/Behaviors/NotificationBehavior.cs`, see `IsInAppAllowed` at line ~88). Preferences entity: `src/DevFlow.Domain/Entities/NotificationPreferences.cs` — 6 booleans (Email + InApp × Assignment/Mention/SprintStarted).

**The gap:** only 3 event types have email templates + toggles (`TaskAssigned`, `Mention`, `SprintStarted`). These 4 event types create in-app notifications but have **no email and no toggle**:
- `StatusChanged` (task status change)
- `CommentAdded`
- `RoleChanged` (workspace member role change)
- `RemovedFromWorkspace`

**Test gap:** these Application feature folders have zero unit tests — `BulkOperations`, `Email`, `Export`, `GitHub`, `Import`, `Labels`, `Templates`, `Users`. Highest-value targets: GitHub webhook HMAC + `TaskKeyParser`, Labels CRUD, Template CRUD, email contract.

---

## Task B27.1 — Email templates + toggles for the 4 missing event types

### Files to touch
- `src/DevFlow.Application/Features/Email/EmailService.cs` — interface + `NoOpEmailService`: add 4 methods (`SendTaskStatusChangedEmailAsync`, `SendCommentAddedEmailAsync`, `SendRoleChangedEmailAsync`, `SendRemovedFromWorkspaceEmailAsync`).
- `src/DevFlow.Infrastructure/Email/ResendEmailService.cs` — real Resend-HTML implementations, mirroring the existing 3 templates (subject + `SendEmailAsync` helper already there).
- `src/DevFlow.Domain/Entities/NotificationPreferences.cs` — add 8 booleans, default `true`: `EmailOnStatusChanged`, `InAppOnStatusChanged`, `EmailOnCommentAdded`, `InAppOnCommentAdded`, `EmailOnRoleChanged`, `InAppOnRoleChanged`, `EmailOnRemovedFromWorkspace`, `InAppOnRemovedFromWorkspace`.
- EF migration (command: `dotnet ef migrations add AddStatusCommentRoleNotificationPrefs -o Persistence/Migrations --project src/DevFlow.Infrastructure --startup-project src/DevFlow.Api`).
- `NotificationBehavior.cs` — extend `IsInAppAllowed` for the 4 new categories; gate email dispatch on `EmailOn*` (inject `IEmailService` — mirror how the pipeline already gets `INotificationPreferencesRepository`).
- `src/DevFlow.Api/Controllers/NotificationPreferencesController.cs` — extend GET/PUT DTOs with the 8 new fields.
- The handlers/commands that raise these events (`StatusChanged` → task update handler; `CommentAdded` → comment handler; `RoleChanged`/`RemovedFromWorkspace` → workspace member handlers) — wire email + in-app creation to the new toggles, **mirroring the existing inline gating pattern** in `UpdateTaskItemCommandHandler`/`CreateCommentCommandHandler`.

### Acceptance criteria
- Each of the 4 event types can be muted (email + in-app) independently via `GET/PUT /users/me/notification-preferences`.
- Emails for the 4 events flow through the existing Resend path when the matching `EmailOn*` is enabled.
- New preference fields round-trip via the API.
- Unit tests for pref gating per new event type.
- `dotnet build` + `dotnet test` green.

---

## Task B27.2 — Unit tests for untested features

New test folders under `tests/DevFlow.UnitTests/Features/`, mirroring `tests/DevFlow.UnitTests/Features/Sprints/DeleteSprintCommandHandlerTests.cs` (NSubstitute + `Substitute.For<IRepo>()`).

### Priority order
1. **GitHub** — webhook HMAC verification + event routing (`src/DevFlow.Application/Features/GitHub/GitHubWebhookHandlers.cs`, `TaskKeyParser.cs`; the HMAC `sha256=` compute lives in `src/DevFlow.Api/Controllers/GitHubWebhookController.cs` — extract the pure HMAC function if needed to test it). Cover: valid signature passes, bad signature rejected, PR-opened/closed routing, issue-title → task-key parsing.
2. **Labels** — CRUD handler tests (`src/DevFlow.Application/Features/Labels/LabelHandlers.cs`).
3. **Templates** — CRUD handler tests (`src/DevFlow.Application/Features/Templates/TemplateHandlers.cs`).
4. **Email** — verify `NoOpEmailService` returns completed tasks and (if cheap) `ResendEmailService` builds expected request payloads via a mocked `HttpClient`.

### Acceptance criteria
- ≥10 new tests across GitHub (HMAC + routing), Labels, Templates, Email.
- `dotnet test` green, no flaky/order-dependent tests.

---

## Notes
- Keep changes within backend scope. Don't touch `frontend/` (Agents C/D own it). Don't touch `api.ts`.
- If `TaskKeyParser` or the HMAC helper needs extracting to be testable, do the minimal extractive refactor (it's a testability improvement, allowed).
- Update `docs/sprint27/plan.md` checklist if a task's scope changes materially.
- Open ONE PR containing both tasks when green; ping the team lead for review.
