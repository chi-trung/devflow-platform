# 🤖 Sprint 30 — Agent B (Backend): Watchers Query + Integration Tests

**Role:** Backend Developer (C# / .NET 8, Clean Architecture, CQRS+MediatR, EF Core + PostgreSQL)
**Branch:** `feat/backend-sprint30-watchers-integration` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `dotnet build` + `dotnet test` 100% green. Do NOT touch shared files without locking: `TasksController.cs` (you add the watchers action — lock it with A, who is NOT touching it this sprint), `src/DevFlow.Application/Features/Tasks/Watch/` (yours).

---

## Your scope: 2 tasks

### B30.1 — `GetTaskWatchersQuery` + endpoint + unit tests

**Files:** `src/DevFlow.Application/Features/Tasks/Watch/GetTaskWatchersQuery.cs` (new), `src/DevFlow.Application/Common/Interfaces/ITaskWatcherRepository.cs` (verify `GetByTaskAsync` exists — `CreateCommentCommandHandler` already calls it, so it should), `src/DevFlow.Api/Controllers/TasksController.cs` (add watchers action only), `tests/DevFlow.UnitTests/Features/Tasks/GetTaskWatchersQueryHandlerTests.cs` (new)

Watch/unwatch exists (`WatchTaskCommand`, `UnwatchTaskCommand`, `IsWatchingTaskQuery`) but there is NO query to list who watches a task. Build it:

1. **Query + DTO** in `GetTaskWatchersQuery.cs`:
```csharp
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskWatchersQuery(Guid WorkspaceId, Guid ProjectId, Guid TaskId)
    : IRequest<IReadOnlyList<TaskWatcherResponse>>, IWorkspaceRequest;

public sealed record TaskWatcherResponse(Guid UserId, string Username, string DisplayName);
```
2. **Handler:** mirror `IsWatchingTaskQueryHandler` — fetch task via `ITaskRepository`; if task is null OR `task.ProjectId != ProjectId` throw `NotFoundException(nameof(TaskItem), TaskId)` (mirror the sprint-scoping check in `UpdateSprintCommandHandler`). Then `watcherRepository.GetByTaskAsync(taskId)`. Resolve display names in bulk with `userRepository.GetDisplayNamesAsync(userIds, ct)` — the exact pattern `ListActivitiesQueryHandler` uses (avoids N+1). Return `TaskWatcherResponse` list ordered by username.
3. **Endpoint** in `TasksController.cs` (alongside the existing watch/unwatch actions):
```csharp
[HttpGet("{taskId:guid}/watchers")]
[ProducesResponseType(typeof(IReadOnlyList<TaskWatcherResponse>), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<IActionResult> GetWatchers(Guid workspaceId, Guid projectId, Guid taskId, CancellationToken ct)
```
Route: `GET /api/v1/workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/watchers`.

**Unit tests (≥4)** in `GetTaskWatchersQueryHandlerTests.cs` (NSubstitute, mirror existing handler tests):
- Happy path — task exists, 2 watchers, returns list with display names.
- No watchers — task exists, returns empty list.
- Task not found → `NotFoundException`.
- Task belongs to different project → `NotFoundException` (scoping check).

**Acceptance:**
- `GET /tasks/{taskId}/watchers` returns `[{ userId, username, displayName }]`.
- Handler + repository wired, no N+1 on display names.
- `dotnet build` + `dotnet test` green.

---

### B30.2 — `ProjectAndSprintIntegrationTests.cs`

**Files:** `tests/DevFlow.IntegrationTests/ProjectAndSprintIntegrationTests.cs` (new)

The only integration test today is `AuthAndWorkspaceIntegrationTests.cs` (register → login → create workspace). Add a second end-to-end flow covering project → sprint → task:

1. Mirror `AuthAndWorkspaceIntegrationTests.cs` exactly:
   - `public class ProjectAndSprintIntegrationTests(DevFlowWebApplicationFactory factory) : IClassFixture<DevFlowWebApplicationFactory>`.
   - `private readonly HttpClient client = factory.CreateClient();`
   - First line of the test: `if (!DevFlowWebApplicationFactory.IsDockerAvailable) { return; }`.
   - Throw-with-response-body helper for assertion failures (copy the pattern).
2. Flow (register → login with unique email `user_{Guid:N}@test.io` → set `Authorization: Bearer <token>` header → create workspace → create project → create sprint → create task → PATCH task to `InProgress` → verify the task's `status` field).
3. Use `PostAsJsonAsync` + `ReadFromJsonAsync<JsonElement>` and the real request shapes the API validates. Confirm the exact field names by reading `AuthAndWorkspaceIntegrationTests.cs` and the workspace/project/sprint/task controllers (e.g. `CreateProjectRequest(name, key, description)`, `CreateSprintRequest(name, goal)`, `CreateTaskItemRequest(title, description, priority, dueDateUtc)`).

**Acceptance:**
- New flow passes when Docker + Postgres are available; skips cleanly when not.
- `dotnet test` green with and without Docker.

---

## ⚠️ Coordination notes

- **`TasksController.cs`** is shared — you add ONLY the `watchers` action. Agent A is not touching it this sprint, but keep your diff surgical.
- Backend lands Swagger/OpenAPI + tests first so Agent C can wire the frontend to the confirmed shape (`{ userId, username, displayName }`).

## 🚀 Definition of Done
- [ ] B30.1 `GetTaskWatchersQuery` + handler + `GET /tasks/{taskId}/watchers` + ≥4 unit tests
- [ ] B30.2 `ProjectAndSprintIntegrationTests.cs` (project/sprint/task flow, Docker guard)
- [ ] `dotnet build` + `dotnet test` green
- [ ] PR targets `main`, conventional commits, no shared-file conflicts
