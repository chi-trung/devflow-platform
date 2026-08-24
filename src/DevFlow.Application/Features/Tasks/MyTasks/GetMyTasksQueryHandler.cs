using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.MyTasks;

public sealed class GetMyTasksQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ISprintRepository sprintRepository) : IRequestHandler<GetMyTasksQuery, IReadOnlyList<MyTaskItem>>
{
    public async Task<IReadOnlyList<MyTaskItem>> Handle(
        GetMyTasksQuery request,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(request.WorkspaceId, cancellationToken);
        if (projects.Count == 0)
        {
            return [];
        }

        var projectIds = projects.Select(project => project.Id).ToHashSet();
        var allTasks = await taskItemRepository.GetByAssigneeIdAsync(request.UserId, cancellationToken);
        var myTasks = allTasks
            .Where(task => projectIds.Contains(task.ProjectId))
            .OrderByDescending(task => task.DueDateUtc ?? task.CreatedAtUtc)
            .ToList();

        if (myTasks.Count == 0)
        {
            return [];
        }

        var sprintIds = myTasks
            .Where(task => task.SprintId.HasValue)
            .Select(task => task.SprintId!.Value)
            .Distinct()
            .ToList();

        var sprints = new Dictionary<Guid, Sprint>();
        if (sprintIds.Count > 0)
        {
            foreach (var sprintId in sprintIds)
            {
                var sprint = await sprintRepository.GetByIdAsync(sprintId, cancellationToken);
                if (sprint is not null)
                {
                    sprints[sprintId] = sprint;
                }
            }
        }

        var projectById = projects.ToDictionary(project => project.Id);

        var items = myTasks.Select(task =>
        {
            var project = projectById[task.ProjectId];
            var sprint = task.SprintId is not null ? sprints.GetValueOrDefault(task.SprintId.Value) : null;

            return new MyTaskItem(
                task.Id,
                task.ProjectId,
                project.Name,
                project.Key,
                task.Title,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.DueDateUtc,
                task.CompletedAtUtc,
                task.SprintId,
                sprint?.Name);
        }).ToList();

        return items;
    }
}
