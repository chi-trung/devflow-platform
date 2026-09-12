using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Import;

/// <summary>One parsed row from a CSV/JSON task import, pre-validation.</summary>
public sealed record ImportTaskRow(string Title, string? Description, string Status, string Priority);

/// <summary>
/// Creates tasks from parsed CSV/JSON import rows. Lives as a command (not a
/// repository write in the controller) because the old endpoint was an
/// anonymous, tenant-blind write: no authentication, no workspace membership
/// check, no project-to-workspace validation, and no cache invalidation —
/// imported tasks left the board's cached pages stale for the full TTL.
/// IProjectRequest + [RequireWorkspaceRole] route the write through the same
/// authorization pipeline every other mutation uses; IProjectEvent (with the
/// default empty ActivityVerb, so a bulk import does not flood the feed —
/// same reasoning as ImportProjectBackupCommand) supplies the cache
/// invalidation and the realtime board-wake.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ImportTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    IReadOnlyList<ImportTaskRow> Rows) : IRequest<ImportTasksResult>, IProjectRequest, IProjectEvent;

public sealed record ImportTasksResult(
    int Imported,
    int Skipped,
    IReadOnlyList<string> Errors);
