using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Dashboard;

public sealed class GetDashboardQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLogRepository) : IRequestHandler<GetDashboardQuery, DashboardResponse>
{
    public async Task<DashboardResponse> Handle(GetDashboardQuery query, CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(query.WorkspaceId, cancellationToken);
        var projectIds = projects.Select(p => p.Id).ToList();

        // Aggregate tasks across all projects
        var allTasks = new List<Domain.Entities.TaskItem>();
        foreach (var projectId in projectIds)
        {
            var tasks = await taskItemRepository.GetForProjectAsync(projectId, null, cancellationToken);
            allTasks.AddRange(tasks);
        }

        // Tasks by status
        var tasksByStatus = allTasks
            .GroupBy(t => t.Status.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        // Tasks by priority
        var tasksByPriority = allTasks
            .GroupBy(t => t.Priority.ToString())
            .ToDictionary(g => g.Key, g => g.Count());

        // Recent activity (last 5 per project, then take top 5 overall)
        var activities = new List<ActivityItem>();
        foreach (var projectId in projectIds)
        {
            var projectActivities = await activityLogRepository.GetForProjectAsync(projectId, 5, cancellationToken);
            activities.AddRange(projectActivities.Select(a => new ActivityItem(
                "", // Will be resolved by frontend or we can batch resolve
                a.Action,
                a.Target,
                a.CreatedAtUtc)));
        }

        var recentActivity = activities
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(5)
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
