using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Attachments;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListTaskAttachmentsQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<IReadOnlyList<TaskAttachmentResponse>>, IWorkspaceRequest;

public sealed class ListTaskAttachmentsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository)
    : IRequestHandler<ListTaskAttachmentsQuery, IReadOnlyList<TaskAttachmentResponse>>
{
    public async Task<IReadOnlyList<TaskAttachmentResponse>> Handle(
        ListTaskAttachmentsQuery query,
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

        var attachments = await taskAttachmentRepository.GetForTaskAsync(query.TaskId, cancellationToken);

        return attachments
            .Select(att => new TaskAttachmentResponse(
                att.Id,
                att.TaskItemId,
                att.FileName,
                att.ContentType,
                att.FileSize,
                att.CreatedAtUtc))
            .ToList();
    }
}
