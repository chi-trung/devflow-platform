using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Dependencies;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

public sealed class ReorderTasksCommandHandler(
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork,
    ITaskDependencyRepository dependencyRepository) : IRequestHandler<ReorderTasksCommand>
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

        // Blocked-move enforcement. A drag that crosses columns is a status
        // change and is rejected while the task has unresolved non-cyclic
        // blockers; same-column drops change no status and stay free. The
        // project edge set is loaded once for the whole batch, and because
        // the guard throws before SaveChanges, one blocked card rejects the
        // entire reorder — no partial batch can slip past.
        var blockedMoves = await BlockedTaskMoves.EvaluateAsync(
            dependencyRepository, command.ProjectId, cancellationToken);

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
                if (status != task.Status)
                {
                    blockedMoves.ThrowIfBlocked(task.Id, task.Title);
                }

                task.ChangeStatus(status);
            }

            task.Position = item.Position;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
