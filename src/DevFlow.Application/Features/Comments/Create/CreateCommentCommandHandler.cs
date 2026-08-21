using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Comments.Create;

public sealed class CreateCommentCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ICommentRepository commentRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateCommentCommand, CommentResponse>
{
    public async Task<CommentResponse> Handle(
        CreateCommentCommand command,
        CancellationToken cancellationToken)
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

        var comment = Comment.Create(command.TaskId, userContext.UserId, command.Content);

        await commentRepository.AddAsync(comment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new CommentResponse(comment.Id, comment.TaskItemId, comment.AuthorId, comment.Content, comment.CreatedAtUtc);
    }
}
