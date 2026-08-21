using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Attachments;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UploadTaskAttachmentCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string FileName,
    string ContentType,
    long FileSize,
    byte[] Data) : IRequest<TaskAttachmentResponse>, IWorkspaceRequest, IProjectEvent
{
    public Guid? ActivityTaskId => TaskId;
    public string ActivityVerb => "attached file";
    public string ActivityLabel => FileName;
}

public sealed class UploadTaskAttachmentCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UploadTaskAttachmentCommand, TaskAttachmentResponse>
{
    public async Task<TaskAttachmentResponse> Handle(
        UploadTaskAttachmentCommand command,
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

        var attachment = TaskAttachment.Create(
            command.TaskId,
            command.FileName,
            command.ContentType,
            command.FileSize,
            command.Data);

        await taskAttachmentRepository.AddAsync(attachment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new TaskAttachmentResponse(
            attachment.Id,
            attachment.TaskItemId,
            attachment.FileName,
            attachment.ContentType,
            attachment.FileSize,
            attachment.CreatedAtUtc);
    }
}
