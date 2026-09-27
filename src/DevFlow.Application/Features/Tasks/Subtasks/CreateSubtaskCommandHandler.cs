using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

public sealed class CreateSubtaskCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateSubtaskCommand, SubtaskCreatedResponse>
{
    public async Task<SubtaskCreatedResponse> Handle(
        CreateSubtaskCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var parent = await taskItemRepository.GetByIdAsync(command.ParentTaskId, cancellationToken);

        if (parent is null || parent.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.ParentTaskId);
        }

        if (parent.ParentTaskId is not null)
        {
            throw new InvalidHierarchyException(
                parent.Id,
                "Subtask",
                "Task",
                $"\"{parent.Title}\" is already a subtask — subtasks cannot be nested more than one level deep.",
                $"Resolve the top-level task that contains \"{parent.Title}\" (task id {parent.ParentTaskId}) and create the subtask under it instead.");
        }

        var subtask = TaskItem.Create(
            command.ProjectId,
            command.Title,
            command.Description,
            command.Priority);

        subtask.AttachToParent(parent.Id);

        if (parent.SprintId is not null)
        {
            subtask.AssignToSprint(parent.SprintId.Value);
        }

        if (parent.EpicId is not null)
        {
            subtask.AttachToEpic(parent.EpicId);
        }

        // A subtask is a task row like any other: it needs its own number in the
        // project's sequence. Without this every subtask kept the CLR default of
        // 0, and the (project_id, number) unique index rejected the second one —
        // so a project could hold exactly one subtask, and creating another was
        // a 500 rather than a story.
        await TaskNumberAssigner.SaveWithNumberAsync(
            subtask, taskItemRepository, unitOfWork, command.ProjectId, cancellationToken);

        return new SubtaskCreatedResponse(subtask.Id, parent.Id);
    }
}
