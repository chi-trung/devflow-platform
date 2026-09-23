using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Calendar;

public sealed class GetProjectCalendarQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<GetProjectCalendarQuery, CalendarTaskListResponse>
{
    /// <summary>~13 months — enough for month navigation without unbounded scans.</summary>
    private static readonly TimeSpan MaxRange = TimeSpan.FromDays(400);

    public async Task<CalendarTaskListResponse> Handle(
        GetProjectCalendarQuery query,
        CancellationToken cancellationToken)
    {
        if (query.FromUtc >= query.ToUtc)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["from"] = ["Calendar range requires from < to."],
            });
        }

        if (query.ToUtc - query.FromUtc > MaxRange)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["from"] = ["Calendar range exceeds 400 days."],
            });
        }

        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var tasks = await taskItemRepository.GetDueBetweenAsync(
            query.ProjectId,
            query.FromUtc,
            query.ToUtc,
            cancellationToken);

        var items = tasks
            .Select(task => new CalendarTaskItem(
                task.Id,
                TaskKey.Format(project.Key, task.Number),
                task.Number,
                task.Title,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.DueDateUtc,
                task.AssigneeId))
            .ToList();

        return new CalendarTaskListResponse(items);
    }
}
