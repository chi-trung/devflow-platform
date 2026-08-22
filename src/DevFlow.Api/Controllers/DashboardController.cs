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
        // Get all project IDs in the workspace
        var projectIds = await dbContext.Projects
            .AsNoTracking()
            .Where(p => p.WorkspaceId == workspaceId)
            .Select(p => p.Id)
            .ToListAsync(cancellationToken);

        // ONE query for all tasks across all projects
        var tasks = await dbContext.TaskItems
            .AsNoTracking()
            .Where(t => projectIds.Contains(t.ProjectId))
            .Select(t => new
            {
                t.Status,
                t.Priority,
                t.DueDateUtc,
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
            recentActivity = activities,
            upcomingDeadlines = tasks
                .Where(t =>
                    t.DueDateUtc.HasValue &&
                    t.Status != TaskItemStatus.Done &&
                    t.DueDateUtc.Value >= now &&
                    t.DueDateUtc.Value <= weekAhead)
                .OrderBy(t => t.DueDateUtc)
                .Take(5)
                .Select(t => new { dueDateUtc = t.DueDateUtc })
                .ToArray(),
        };

        return Ok(result);
    }
}
