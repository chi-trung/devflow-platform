using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Comments.List;

public sealed class ListCommentsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ICommentRepository commentRepository) : IRequestHandler<ListCommentsQuery, IReadOnlyList<CommentResponse>>
{
    public async Task<IReadOnlyList<CommentResponse>> Handle(
        ListCommentsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(query.TaskId, cancellationToken);

        if (task is null || task.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.TaskId);
        }

        var comments = await commentRepository.GetForTaskAsync(query.TaskId, cancellationToken);

        return comments
            .Select(comment => new CommentResponse(
                comment.Id,
                comment.TaskItemId,
                comment.AuthorId,
                comment.Content,
                comment.CreatedAtUtc))
            .ToList();
    }
}
