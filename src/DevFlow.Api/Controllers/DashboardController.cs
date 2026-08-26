using DevFlow.Infrastructure.Persistence;
using DevFlow.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/dashboard")]
public sealed class DashboardController(DevFlowDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetDashboard(
        Guid workspaceId,
        CancellationToken cancellationToken)
    {
        // Get all active projects in the workspace. Archived (soft-deleted)
        // projects are excluded by the global query filter — matching what
        // the frontend's project list and deriveDashboard fallback see, so
        // the API and fallback paths always agree.
        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(p => p.WorkspaceId == workspaceId)
            .Select(p => new { p.Id, p.Name, p.Key })
            .ToListAsync(cancellationToken);

        var projectIds = projects.Select(p => p.Id).ToList();
        var projectMap = projects.ToDictionary(p => p.Id);

        // ONE query for all tasks across all projects
        var tasks = await dbContext.TaskItems
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Select(t => new
            {
                t.Id,
                t.Status,
                t.Priority,
                t.DueDateUtc,
                t.ProjectId,
                t.Title,
            })
            .ToListAsync(cancellationToken);

        // ONE query for recent activity (last 20)
        var activities = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(a => a.WorkspaceId == workspaceId)
            .OrderByDescending(a => a.CreatedAtUtc)
            .Take(20)
            .Select(a => new
            {
                id = a.Id,
                action = a.Action,
                target = a.Target,
                createdAtUtc = a.CreatedAtUtc,
                projectId = a.ProjectId,
                taskItemId = a.TaskItemId,
                actorName = dbContext.Users
                    .Where(u => u.Id == a.ActorUserId)
                    .Select(u => u.DisplayName ?? u.Username)
                    .FirstOrDefault() ?? "Unknown",
            })
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var weekAhead = now.AddDays(7);

        // Per-project task counts
        var projectStats = projectIds.Select(pid =>
        {
            var projectTasks = tasks.Where(t => t.ProjectId == pid).ToList();
            return new
            {
                projectId = pid,
                projectName = projectMap[pid].Name,
                projectKey = projectMap[pid].Key,
                totalTasks = projectTasks.Count,
                doneTasks = projectTasks.Count(t => t.Status == TaskItemStatus.Done),
                inProgressTasks = projectTasks.Count(t => t.Status == TaskItemStatus.InProgress),
            };
        }).Where(p => p.totalTasks > 0).ToList();

        // Upcoming deadlines with project info. Includes the task id (used
        // as the React key on the dashboard) and the status string, matching
        // the DashboardDeadlineTask contract the frontend expects.
        var upcomingDeadlines = tasks
            .Where(t =>
                t.DueDateUtc.HasValue &&
                t.Status != TaskItemStatus.Done &&
                t.DueDateUtc.Value >= now &&
                t.DueDateUtc.Value <= weekAhead)
            .OrderBy(t => t.DueDateUtc)
            .Take(5)
            .Select(t => new
            {
                id = t.Id,
                title = t.Title,
                projectId = t.ProjectId,
                projectKey = projectMap.ContainsKey(t.ProjectId) ? projectMap[t.ProjectId].Key : "",
                projectName = projectMap.ContainsKey(t.ProjectId) ? projectMap[t.ProjectId].Name : "",
                dueDateUtc = t.DueDateUtc,
                priority = t.Priority.ToString(),
                status = t.Status.ToString(),
            })
            .ToList();

        var result = new
        {
            totalTasks = tasks.Count,
            // The JSON serializer camel-cases anonymous-object property names,
            // which would turn "Backlog" into "backlog" and silently zero out
            // every chart the frontend reads (data.tasksByStatus["Backlog"] ?? 0).
            // Dictionary keys are left untouched by the naming policy, so use
            // explicit dictionaries with PascalCase enum keys to match the
            // DashboardData contract (and the CQRS handler's output).
            tasksByStatus = new Dictionary<string, int>
            {
                [nameof(TaskItemStatus.Idea)] = tasks.Count(t => t.Status == TaskItemStatus.Idea),
                [nameof(TaskItemStatus.Planning)] = tasks.Count(t => t.Status == TaskItemStatus.Planning),
                [nameof(TaskItemStatus.Approval)] = tasks.Count(t => t.Status == TaskItemStatus.Approval),
                [nameof(TaskItemStatus.Ready)] = tasks.Count(t => t.Status == TaskItemStatus.Ready),
                [nameof(TaskItemStatus.InProgress)] = tasks.Count(t => t.Status == TaskItemStatus.InProgress),
                [nameof(TaskItemStatus.Review)] = tasks.Count(t => t.Status == TaskItemStatus.Review),
                [nameof(TaskItemStatus.Done)] = tasks.Count(t => t.Status == TaskItemStatus.Done),
            },
            tasksByPriority = new Dictionary<string, int>
            {
                [nameof(TaskItemPriority.Low)] = tasks.Count(t => t.Priority == TaskItemPriority.Low),
                [nameof(TaskItemPriority.Medium)] = tasks.Count(t => t.Priority == TaskItemPriority.Medium),
                [nameof(TaskItemPriority.High)] = tasks.Count(t => t.Priority == TaskItemPriority.High),
                [nameof(TaskItemPriority.Critical)] = tasks.Count(t => t.Priority == TaskItemPriority.Critical),
            },
            overdueCount = tasks.Count(t =>
                t.DueDateUtc.HasValue &&
                t.Status != TaskItemStatus.Done &&
                t.DueDateUtc.Value < now),
            projectStats,
            recentActivity = activities,
            upcomingDeadlines,
        };

        return Ok(result);
    }
}
