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
        // Get all projects in the workspace
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

        // Upcoming deadlines with project info
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
                title = t.Title,
                projectId = t.ProjectId,
                projectKey = projectMap.ContainsKey(t.ProjectId) ? projectMap[t.ProjectId].Key : "",
                projectName = projectMap.ContainsKey(t.ProjectId) ? projectMap[t.ProjectId].Name : "",
                dueDateUtc = t.DueDateUtc,
                priority = t.Priority.ToString(),
            })
            .ToList();

        var result = new
        {
            totalTasks = tasks.Count,
            tasksByStatus = new
            {
                Backlog = tasks.Count(t => t.Status == TaskItemStatus.Backlog),
                InProgress = tasks.Count(t => t.Status == TaskItemStatus.InProgress),
                InReview = tasks.Count(t => t.Status == TaskItemStatus.InReview),
                Done = tasks.Count(t => t.Status == TaskItemStatus.Done),
            },
            tasksByPriority = new
            {
                Low = tasks.Count(t => t.Priority == TaskItemPriority.Low),
                Medium = tasks.Count(t => t.Priority == TaskItemPriority.Medium),
                High = tasks.Count(t => t.Priority == TaskItemPriority.High),
                Critical = tasks.Count(t => t.Priority == TaskItemPriority.Critical),
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
