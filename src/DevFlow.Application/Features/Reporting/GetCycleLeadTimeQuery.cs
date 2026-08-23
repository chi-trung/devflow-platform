using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Reporting;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetCycleLeadTimeQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<CycleLeadTimeResponse>, IWorkspaceRequest;

public sealed class GetCycleLeadTimeHandler(
    ITaskItemRepository taskItemRepository)
    : IRequestHandler<GetCycleLeadTimeQuery, CycleLeadTimeResponse>
{
    public async Task<CycleLeadTimeResponse> Handle(
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
