using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Reporting;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetVelocityHistoryQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<VelocityHistoryResponse>, IWorkspaceRequest;

public sealed class GetVelocityHistoryHandler(
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    ICacheService cacheService)
    : IRequestHandler<GetVelocityHistoryQuery, VelocityHistoryResponse>
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public async Task<VelocityHistoryResponse> Handle(
        GetVelocityHistoryQuery request,
        CancellationToken ct)
    {
        var cacheKey = $"velocity-history:{request.ProjectId}";
        var tag = $"project:{request.ProjectId}";

        return await cacheService.GetOrSetAsync(
            cacheKey,
            ct2 => ComputeAsync(request, ct2),
            CacheTtl,
            [tag],
            ct);
    }

    private async Task<VelocityHistoryResponse> ComputeAsync(
        GetVelocityHistoryQuery request,
        CancellationToken ct)
    {
        var sprints = await sprintRepository.GetForProjectAsync(request.ProjectId, ct);
        var tasks = await taskItemRepository.GetForProjectAsync(request.ProjectId, null, ct);

        var scheduledSprints = sprints
            .Where(sprint => sprint.StartDateUtc.HasValue)
            .OrderBy(sprint => sprint.StartDateUtc)
            .TakeLast(10)
            .ToList();

        var points = new List<VelocityHistoryPoint>();

        foreach (var sprint in scheduledSprints)
        {
            var sprintTasks = tasks.Where(task => task.SprintId == sprint.Id).ToList();
            var totalStoryPoints = sprintTasks.Sum(task => task.StoryPoints ?? 0);
            var completedStoryPoints = sprintTasks
                .Where(task => task.Status == TaskItemStatus.Done)
                .Sum(task => task.StoryPoints ?? 0);

            points.Add(new VelocityHistoryPoint(
                sprint.Id,
                sprint.Name,
                totalStoryPoints,
                completedStoryPoints,
                sprint.EndDateUtc));
        }

        var averageCompleted = points.Count > 0
            ? Math.Round(points.Average(point => point.CompletedStoryPoints), 2)
            : 0;

        var averageTotal = points.Count > 0
            ? Math.Round(points.Average(point => point.TotalStoryPoints), 2)
            : 0;

        return new VelocityHistoryResponse(points, averageCompleted, averageTotal);
    }
}
