using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Attachments;

public sealed record TaskAttachmentFileResult(
    byte[] Data,
    string ContentType,
    string FileName);

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DownloadTaskAttachmentQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid AttachmentId) : IRequest<TaskAttachmentFileResult>, IWorkspaceRequest;

public sealed class DownloadTaskAttachmentQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository)
    : IRequestHandler<DownloadTaskAttachmentQuery, TaskAttachmentFileResult>
{
    public async Task<TaskAttachmentFileResult> Handle(
        DownloadTaskAttachmentQuery query,
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

        var attachment = await taskAttachmentRepository.GetByIdAsync(query.AttachmentId, cancellationToken);
        if (attachment is null || attachment.TaskItemId != query.TaskId)
        {
            throw new NotFoundException(nameof(TaskAttachment), query.AttachmentId);
        }

        return new TaskAttachmentFileResult(
            attachment.Data,
            attachment.ContentType,
            attachment.FileName);
    }
}
