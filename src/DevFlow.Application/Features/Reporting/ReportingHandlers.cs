using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Reporting;

// Burndown Chart
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetBurndownQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    DateOnly StartDate,
    DateOnly EndDate) : IRequest<BurndownResponse>, IWorkspaceRequest;

public class GetBurndownHandler(
    IReportingRepository reportingRepository)
    : IRequestHandler<GetBurndownQuery, BurndownResponse>
{
    public async Task<BurndownResponse> Handle(GetBurndownQuery request, CancellationToken ct)
    {
        var tasks = await reportingRepository.GetTasksByProjectAsync(request.ProjectId, ct);

        var totalTasks = tasks.Count;
        var points = new List<BurndownPoint>();
        var totalDays = request.EndDate.DayNumber - request.StartDate.DayNumber;

        for (var i = 0; i <= totalDays; i++)
        {
            var date = request.StartDate.AddDays(i);
            var dateUtc = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

            var completed = tasks.Count(t =>
                t.Status == TaskItemStatus.Done &&
                t.CompletedAtUtc.HasValue &&
                t.CompletedAtUtc.Value.Date <= dateUtc.Date);

            var remaining = totalTasks - completed;
            var idealRemaining = totalDays > 0
                ? (int)Math.Round(totalTasks * (1.0 - (double)i / totalDays))
                : totalTasks;

            points.Add(new BurndownPoint(date, remaining, idealRemaining));
        }

        return new BurndownResponse(request.StartDate, request.EndDate, totalTasks, points);
    }
}

// Velocity Report
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetVelocityQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<VelocityResponse>, IWorkspaceRequest;

public class GetVelocityHandler(
    IReportingRepository reportingRepository)
    : IRequestHandler<GetVelocityQuery, VelocityResponse>
{
    public async Task<VelocityResponse> Handle(GetVelocityQuery request, CancellationToken ct)
    {
        var sprints = await reportingRepository.GetSprintsByProjectAsync(request.ProjectId, ct);
        var allTasks = await reportingRepository.GetTasksByProjectAsync(request.ProjectId, ct);

        var result = new List<SprintVelocity>();

        foreach (var sprint in sprints)
        {
            var sprintTasks = allTasks.Where(t => t.SprintId == sprint.Id).ToList();
            var completed = sprintTasks.Count(t => t.Status == TaskItemStatus.Done);
            var total = sprintTasks.Count;
            var rate = total > 0 ? (double)completed / total : 0;

            result.Add(new SprintVelocity(
                sprint.Id,
                sprint.Name,
                completed,
                total,
                Math.Round(rate, 2)));
        }

        var avgRate = result.Count > 0
            ? Math.Round(result.Average(s => s.CompletionRate), 2)
            : 0;

        return new VelocityResponse(result, avgRate);
    }
}

// Team Report
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTeamReportQuery(
    Guid WorkspaceId,
    DateTimeOffset? StartDateUtc = null,
    DateTimeOffset? EndDateUtc = null) : IRequest<TeamReportResponse>, IWorkspaceRequest;

public class GetTeamReportHandler(
    IWorkspaceRepository workspaceRepository,
    ITaskItemRepository taskItemRepository,
    ITimeEntryRepository timeEntryRepository)
    : IRequestHandler<GetTeamReportQuery, TeamReportResponse>
{
    public async Task<TeamReportResponse> Handle(GetTeamReportQuery request, CancellationToken ct)
    {
        var members = await workspaceRepository.GetMembersAsync(request.WorkspaceId, ct);

        var memberStats = new List<TeamMemberStats>();
        var totalTasks = 0;
        var totalCompleted = 0;
        var totalMinutes = 0;
        var allCycleTimes = new List<double>();

        foreach (var member in members)
        {
            var tasks = await taskItemRepository.GetByAssigneeIdAsync(member.UserId, ct);
            var completed = tasks.Count(t => t.Status == TaskItemStatus.Done);
            var inProgress = tasks.Count(t => t.Status == TaskItemStatus.InProgress);
            var minutes = await timeEntryRepository.GetTotalMinutesByUserIdAsync(member.UserId, ct);

            // Calculate avg cycle time for completed tasks
            var completedTasks = tasks.Where(t => t.Status == TaskItemStatus.Done && t.StartedAtUtc.HasValue && t.CompletedAtUtc.HasValue).ToList();
            double? avgCycleTime = null;
            if (completedTasks.Count > 0)
            {
                var cycleTimes = completedTasks.Select(t => (t.CompletedAtUtc!.Value - t.StartedAtUtc!.Value).TotalDays).ToList();
                avgCycleTime = Math.Round(cycleTimes.Average(), 1);
                allCycleTimes.AddRange(cycleTimes);
            }

            memberStats.Add(new TeamMemberStats(
                member.UserId,
                member.DisplayName,
                tasks.Count,
                completed,
                minutes,
                inProgress,
                avgCycleTime));

            totalTasks += tasks.Count;
            totalCompleted += completed;
            totalMinutes += minutes;
        }

        // Trends: compare the requested period against the preceding window of
        // the same length, if a date range was provided. Otherwise neutral.
        var trends = request.StartDateUtc.HasValue && request.EndDateUtc.HasValue
            ? await ComputeTrendsAsync(request, members, ct)
            : new TeamReportTrends(0, null);

        return new TeamReportResponse(memberStats, totalTasks, totalCompleted, totalMinutes, trends);
    }

    private async Task<TeamReportTrends> ComputeTrendsAsync(
        GetTeamReportQuery request,
        IReadOnlyList<(Guid UserId, string Email, string Username, string DisplayName, Domain.Enums.WorkspaceRole Role)> members,
        CancellationToken ct)
    {
        var start = request.StartDateUtc!.Value;
        var end = request.EndDateUtc!.Value;
        var windowLength = end - start;
        var prevStart = start - windowLength;

        var currentCompleted = 0;
        var previousCompleted = 0;
        var currentCycle = new List<double>();
        var previousCycle = new List<double>();

        foreach (var member in members)
        {
            var tasks = await taskItemRepository.GetByAssigneeIdAsync(member.UserId, ct);

            foreach (var task in tasks.Where(t => t.Status == TaskItemStatus.Done && t.CompletedAtUtc.HasValue))
            {
                var completedAt = task.CompletedAtUtc!.Value;
                if (completedAt >= start && completedAt < end)
                {
                    currentCompleted++;
                    if (task.StartedAtUtc.HasValue)
                    {
                        currentCycle.Add((completedAt - task.StartedAtUtc.Value).TotalDays);
                    }
                }
                else if (completedAt >= prevStart && completedAt < start)
                {
                    previousCompleted++;
                    if (task.StartedAtUtc.HasValue)
                    {
                        previousCycle.Add((completedAt - task.StartedAtUtc.Value).TotalDays);
                    }
                }
            }
        }

        var completedDelta = currentCompleted - previousCompleted;

        double? cycleDelta = null;
        if (currentCycle.Count > 0 && previousCycle.Count > 0)
        {
            cycleDelta = Math.Round(currentCycle.Average() - previousCycle.Average(), 1);
        }
        else if (currentCycle.Count > 0)
        {
            cycleDelta = Math.Round(currentCycle.Average(), 1);
        }

        return new TeamReportTrends(completedDelta, cycleDelta);
    }
}
