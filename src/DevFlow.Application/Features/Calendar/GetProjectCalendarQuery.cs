using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Calendar;

/// <summary>
/// Month-grid feed for the project calendar: tasks with a due date in
/// [FromUtc, ToUtc). Lighter than the board list (no attachments/PRs/labels)
/// so a full month stays one small payload.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetProjectCalendarQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    DateTimeOffset FromUtc,
    DateTimeOffset ToUtc) : IRequest<CalendarTaskListResponse>, IWorkspaceRequest;

public sealed record CalendarTaskListResponse(IReadOnlyList<CalendarTaskItem> Items);

public sealed record CalendarTaskItem(
    Guid Id,
    string Key,
    int Number,
    string Title,
    string Status,
    string Priority,
    DateTimeOffset? DueDateUtc,
    Guid? AssigneeId);
