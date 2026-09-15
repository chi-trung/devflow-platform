using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

public sealed class ReorderTasksCommandHandler(
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ReorderTasksCommand>
{
    public async Task Handle(ReorderTasksCommand command, CancellationToken cancellationToken)
    {
        // Membership in the claimed workspace is already gated by
        // WorkspaceAuthorizationBehavior; this pins the project to that
        // workspace, otherwise a member of workspace A could reorder any
        // project by presenting A's id with B's projectId.
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        foreach (var item in command.Tasks)
        {
            var task = await taskItemRepository.GetByIdAsync(item.Id, cancellationToken);

            // Reject, don't skip: a foreign task id in the list is either a
            // client bug or an enumeration probe. Silent `continue` let a
            // mixed batch mutate the rows the caller does own while the
            // intrusion left no trace.
            if (task is null || task.ProjectId != command.ProjectId)
            {
                throw new NotFoundException(nameof(TaskItem), item.Id);
            }

            if (Enum.TryParse<TaskItemStatus>(item.Status, true, out var status))
            {
                task.ChangeStatus(status);
            }

            task.Position = item.Position;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
