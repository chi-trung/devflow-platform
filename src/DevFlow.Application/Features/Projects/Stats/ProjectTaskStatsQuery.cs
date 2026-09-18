using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Stats;

/// <summary>
/// Task counts for every project in a workspace, returned by ONE query
/// instead of one request per project.
/// </summary>
public sealed record ProjectTaskStatsQuery(Guid WorkspaceId)
    : IRequest<IReadOnlyList<ProjectTaskStatsResponse>>, IWorkspaceRequest;

/// <summary>
/// Counts for a single project. <see cref="TotalTasks"/> is the full task
/// count, <see cref="DoneTasks"/> the subset in <see cref="TaskItemStatus.Done"/>.
/// </summary>
public sealed record ProjectTaskStatsResponse(Guid ProjectId, int TotalTasks, int DoneTasks);
