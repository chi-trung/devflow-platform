using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Dashboard;

public sealed class GetDashboardQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLogRepository,
    IUserRepository userRepository,
    ICacheService cacheService) : IRequestHandler<GetDashboardQuery, DashboardResponse>
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);

    public async Task<DashboardResponse> Handle(GetDashboardQuery query, CancellationToken cancellationToken)
    {
        var cacheKey = $"dashboard:{query.WorkspaceId}";

        // Tag with each project so any project mutation invalidates the dashboard.
        var projects = await projectRepository.GetForWorkspaceAsync(query.WorkspaceId, cancellationToken);
        var tags = projects.Select(p => $"project:{p.Id}").ToArray();

        return await cacheService.GetOrSetAsync(
            cacheKey,
            ct => LoadDashboardAsync(query, projects, cancellationToken),
            CacheTtl,
            tags,
            cancellationToken);
    }

    private async Task<DashboardResponse> LoadDashboardAsync(
        GetDashboardQuery query,
        IReadOnlyList<Project> projects,
        CancellationToken cancellationToken)
    {
        var projectIds = projects.Select(p => p.Id).ToList();

        // Single batch query instead of a per-project loop (was N+1).
        var allTasks = await taskItemRepository.GetForProjectsAsync(projectIds, null, cancellationToken);

        // Tasks by status
        var tasksByStatus = allTasks
            .GroupBy(t => t.Status.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        // Tasks by priority
        var tasksByPriority = allTasks
            .GroupBy(t => t.Priority.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        // Recent activity (top 5 per project in one batch query, then top 5 overall)
        var activities = await activityLogRepository.GetForProjectsAsync(projectIds, 5, cancellationToken);

        var actorIds = activities.Select(a => a.ActorUserId).Distinct().ToList();
        var names = await userRepository.GetDisplayNamesAsync(actorIds, cancellationToken);

        var recentActivity = activities
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(5)
            .Select(a => new ActivityItem(
                names.GetValueOrDefault(a.ActorUserId, "Someone"),
                a.Action,
                a.Target,
                a.CreatedAtUtc))
            .ToList();

        // Upcoming deadlines (next 7 days)
        var upcomingDeadlines = allTasks
            .Where(t => t.DueDateUtc.HasValue &&
                       t.DueDateUtc.Value > DateTimeOffset.UtcNow &&
                       t.DueDateUtc.Value <= DateTimeOffset.UtcNow.AddDays(7))
            .OrderBy(t => t.DueDateUtc)
            .Take(10)
            .Select(t =>
            {
                var project = projects.FirstOrDefault(p => p.Id == t.ProjectId);
                return new DeadlineItem(
                    t.Id,
                    t.Title,
                    project?.Key ?? "",
                    t.DueDateUtc!.Value,
                    t.Status.ToString());
            })
            .ToList();

        return new DashboardResponse(
            allTasks.Count,
            tasksByStatus,
            tasksByPriority,
            recentActivity,
            upcomingDeadlines);
    }
}
