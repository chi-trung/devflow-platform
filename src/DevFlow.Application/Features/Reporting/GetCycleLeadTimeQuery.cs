using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Reporting;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetCycleLeadTimeQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<CycleLeadTimeResponse>, IProjectRequest;

public sealed class GetCycleLeadTimeHandler(
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    ICacheService cacheService)
    : IRequestHandler<GetCycleLeadTimeQuery, CycleLeadTimeResponse>
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public async Task<CycleLeadTimeResponse> Handle(
        GetCycleLeadTimeQuery request,
        CancellationToken ct)
    {
        // Tenant check — the route's workspaceId was authorized but never tied
        // to the projectId; see GetBurndownHandler. Runs BEFORE the cache
        // lookup so a foreign probe can't even key off cached rows.
        var project = await projectRepository.GetByIdAsync(request.ProjectId, ct);

        if (project is null || project.WorkspaceId != request.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), request.ProjectId);
        }

        var cacheKey = $"cycle-lead-time:{request.ProjectId}";
        var tag = $"project:{request.ProjectId}";

        return await cacheService.GetOrSetAsync(
            cacheKey,
            ct2 => ComputeAsync(request, ct2),
            CacheTtl,
            [tag],
            ct);
    }

    private async Task<CycleLeadTimeResponse> ComputeAsync(
        GetCycleLeadTimeQuery request,
        CancellationToken ct)
    {
        var tasks = await taskItemRepository.GetForProjectAsync(request.ProjectId, null, ct);

        var doneTasks = tasks
            .Where(task => task.Status == TaskItemStatus.Done && task.CompletedAtUtc.HasValue)
            .Select(task =>
            {
                var started = task.StartedAtUtc ?? task.CreatedAtUtc;
                var cycleDays = (task.CompletedAtUtc!.Value - started).TotalDays;
                var leadDays = (task.CompletedAtUtc.Value - task.CreatedAtUtc).TotalDays;

                return new TaskCycleLeadTime(
                    task.Id,
                    task.Title,
                    task.Status,
                    task.CreatedAtUtc,
                    task.StartedAtUtc,
                    task.CompletedAtUtc,
                    Math.Round(cycleDays, 2),
                    Math.Round(leadDays, 2));
            })
            .OrderByDescending(task => task.CompletedAtUtc)
            .Take(100)
            .ToList();

        var cycleValues = doneTasks
            .Where(task => task.CycleTimeDays.HasValue)
            .Select(task => task.CycleTimeDays!.Value)
            .OrderBy(value => value)
            .ToArray();

        var leadValues = doneTasks
            .Where(task => task.LeadTimeDays.HasValue)
            .Select(task => task.LeadTimeDays!.Value)
            .OrderBy(value => value)
            .ToArray();

        return new CycleLeadTimeResponse(
            Percentile(cycleValues, 0.5),
            Percentile(cycleValues, 0.9),
            Percentile(leadValues, 0.5),
            Percentile(leadValues, 0.9),
            doneTasks);
    }

    private static double? Percentile(double[] sortedValues, double percentile)
    {
        if (sortedValues.Length == 0)
        {
            return null;
        }

        if (sortedValues.Length == 1)
        {
            return Math.Round(sortedValues[0], 2);
        }

        var rank = percentile * (sortedValues.Length - 1);
        var lower = (int)Math.Floor(rank);
        var upper = (int)Math.Ceiling(rank);

        if (lower == upper)
        {
            return Math.Round(sortedValues[lower], 2);
        }

        var fraction = rank - lower;
        var interpolated = sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * fraction;

        return Math.Round(interpolated, 2);
    }
}
