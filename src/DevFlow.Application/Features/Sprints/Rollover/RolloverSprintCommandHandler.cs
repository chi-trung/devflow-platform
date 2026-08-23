using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Rollover;

public sealed class RolloverSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLogRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RolloverSprintCommand, RolloverResult>
{
    public async Task<RolloverResult> Handle(
        RolloverSprintCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var sprint = await sprintRepository.GetByIdAsync(command.SprintId, cancellationToken);

        if (sprint is null || sprint.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Sprint), command.SprintId);
        }

        if (sprint.Status != SprintStatus.Completed)
        {
            return new RolloverResult(0, 0, null);
        }

        var allSprints = await sprintRepository.GetForProjectAsync(command.ProjectId, cancellationToken);
        var targetSprint = allSprints
            .Where(s => s.Status == SprintStatus.Planned)
            .OrderBy(s => s.StartDateUtc ?? s.CreatedAtUtc)
            .FirstOrDefault();

        var projectTasks = await taskItemRepository.GetForProjectAsync(command.ProjectId, null, cancellationToken);
        var sprintTasks = projectTasks
            .Where(task => task.SprintId == sprint.Id)
            .ToList();

        var completedCount = sprintTasks.Count(task => task.Status == TaskItemStatus.Done);
        var rolloverTasks = sprintTasks
            .Where(task => task.Status != TaskItemStatus.Done)
            .ToList();

        foreach (var task in rolloverTasks)
        {
            if (targetSprint is not null)
            {
                task.AssignToSprint(targetSprint.Id);
            }
            else
            {
                task.RemoveFromSprint();
            }

            await activityLogRepository.AddAsync(ActivityLog.Create(
                command.WorkspaceId,
                command.ProjectId,
                task.Id,
                Guid.Empty,
                $"Rolled over from sprint {sprint.Name}",
                task.Title), cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new RolloverResult(rolloverTasks.Count, completedCount, targetSprint?.Id);
    }
}
