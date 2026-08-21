using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Comments.Delete;

public sealed class DeleteCommentCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ICommentRepository commentRepository,
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteCommentCommand>
{
    public async Task Handle(DeleteCommentCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        var comment = await commentRepository.GetByIdAsync(command.CommentId, cancellationToken);

        if (comment is null || comment.TaskItemId != command.TaskId)
        {
            throw new NotFoundException(nameof(Comment), command.CommentId);
        }

        if (comment.AuthorId != userContext.UserId)
        {
            var role = await workspaceRepository.GetMemberRoleAsync(
                command.WorkspaceId, userContext.UserId, cancellationToken);

            if (role is not (WorkspaceRole.Admin or WorkspaceRole.Owner))
            {
                throw new ForbiddenAccessException();
            }
        }

        await commentRepository.RemoveAsync(comment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
