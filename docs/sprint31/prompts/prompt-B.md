# 🚀 Sprint 31 — Agent B (Backend): Outbox Batch + Epic Dependencies + RBAC Guard

**Role:** Backend Developer (.NET 8, Clean Architecture, CQRS + MediatR)
**Branch:** `feat/backend-sprint31-outbox-epic-rbac` — created from `origin/main`
**PR target:** `main`
**Quality gates:** `dotnet build` + `dotnet test` 100% green. Do NOT touch shared files without locking: `OutboxController.cs` (yours), `EpicsController.cs` (yours), `Program.cs` (lock with A — A31.2 also wires DI for ProjectMember).

---

## Your scope: 3 tasks

### B31.1 — Outbox batch replay-all + purge

**Files:** `src/DevFlow.Application/Features/Outbox/`, `src/DevFlow.Infrastructure/Persistence/Repositories/OutboxRepository.cs`, `src/DevFlow.Api/Controllers/OutboxController.cs`

Sprint 28 (A28.1) added single-message replay. Add batch operations for dead-lettered messages:

- `ReplayAllOutboxMessagesCommand(WorkspaceId)` → returns `ReplayAllResponse(int Requeued)` — reset retry state on ALL dead-lettered messages for the workspace. Reuse the existing `ResetRetryAsync` pattern, batch version (fetch dead-lettered, reset each, single `SaveChangesAsync`).
- `PurgeDeadLetterMessagesCommand(WorkspaceId)` → hard-delete ALL dead-lettered messages for the workspace.

**Endpoints (Admin-gated via `[RequireWorkspaceRole(Admin)]` on the commands):**
```
POST   /api/v1/workspaces/{workspaceId}/outbox/dead-letter/replay-all
DELETE /api/v1/workspaces/{workspaceId}/outbox/dead-letter
```

**Unit tests (≥3):** replay-all resets the whole batch (assert count returned), purge deletes the batch, empty list is a no-op (0 requeued / 0 deleted, no throw).

---

### B31.2 — Epic-to-epic dependencies

**Files:** `src/DevFlow.Domain/Entities/EpicDependency.cs` (new), EF migration, `src/DevFlow.Application/Features/Epics/` (AddEpicDependencyCommand, RemoveEpicDependencyCommand, ListEpicDependenciesQuery), `src/DevFlow.Api/Controllers/EpicsController.cs`, `src/DevFlow.Application/Features/Epics/EpicResponse.cs` (additive `blockedByEpicIds`)

**Model** (mirror `TaskDependency` exactly — the codebase already has this pattern):
```csharp
public class EpicDependency : BaseEntity
{
    public Guid EpicId { get; private set; }        // dependent epic
    public Guid BlockedById { get; private set; }   // the epic blocking it
    public static EpicDependency Create(Guid epicId, Guid blockedById);
}
```
- Unique index `(EpicId, BlockedById)`; no cycle enforcement at MVP (document it in a comment).
- Validate both epics exist AND belong to the same project → else `NotFoundException`.

**Endpoints:**
```
GET    /api/v1/workspaces/{workspaceId}/projects/{projectId}/epics/{epicId}/dependencies
POST   .../epics/{epicId}/dependencies   { blockedByEpicId }
DELETE .../epics/{epicId}/dependencies/{blockedByEpicId}
```
- `EpicResponse` gains `blockedByEpicIds: Guid[]` (append-only — the frontend is tolerant of new fields).

**Unit tests (≥4):** add, remove, list, cross-project NotFound.

---

### B31.3 — Project-level authorization guard

**Files:** `src/DevFlow.Application/Common/Authorization/IProjectRequest.cs` (new), `src/DevFlow.Application/Common/Authorization/RequireProjectRoleAttribute.cs` (new), `src/DevFlow.Application/Common/Behaviors/ProjectAuthorizationBehavior.cs` (new), `src/DevFlow.Api/Program.cs` (register the new behavior)

**Goal:** an OPTIONAL project-role layer ON TOP of the existing workspace check — used ONLY by the project-member commands (Agent A's A31.2). Do not break existing workspace-only authorization.

```csharp
public interface IProjectRequest : IWorkspaceRequest
{
    Guid ProjectId { get; }
}

[AttributeUsage(AttributeTargets.Class)]
public sealed class RequireProjectRoleAttribute(ProjectRole role) : Attribute
{
    public ProjectRole Role { get; } = role;
}
```

- `ProjectAuthorizationBehavior<TRequest, TResponse>`: for a request implementing `IProjectRequest`, look up the `ProjectMember` row for `(request.ProjectId, currentUserId)` via `IProjectMemberRepository`.
  - If the user IS a project member → their `ProjectRole` must meet the attribute minimum, else `ForbiddenException` (check how the existing `WorkspaceAuthorizationBehavior` throws).
  - If the user is NOT a project member → fall through to the existing workspace-role behavior (Owner/Admin/Member still authorized by workspace).
- Register the behavior in the same pipeline as `WorkspaceAuthorizationBehavior`.

**Tests:** extend `RbacAuthorizationTests` with project-scoped cases (project Manager passes project-role gate, project Member denied Manager-level op, non-project workspace Admin still passes).

---

## ⚠️ Coordination notes

- **`Program.cs`** — Agent A also registers DI for ProjectMember (A31.2). Coordinate to avoid a merge conflict: A adds the repository/behavior registrations, B adds `ProjectAuthorizationBehavior` to the pipeline. Both are additive.
- **`EpicResponse.cs`** — you add `blockedByEpicIds`. Agent C/D consumes it in EpicsPage (D31.2). Additive only.
- **`OutboxController.cs`** — you add the two batch endpoints. Agent C's DLQ UI (C31.2) calls them.

## 🚀 Definition of Done
- [ ] B31.1 replay-all + purge endpoints, ≥3 unit tests
- [ ] B31.2 epic dependency CQRS + `blockedByEpicIds`, ≥4 unit tests
- [ ] B31.3 `ProjectAuthorizationBehavior` + tests; existing 30x tests still green
- [ ] PR targets `main`, conventional commits, no shared-file conflicts (rebase if needed)
