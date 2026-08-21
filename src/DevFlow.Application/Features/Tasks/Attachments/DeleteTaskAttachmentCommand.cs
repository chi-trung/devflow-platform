using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Attachments;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteTaskAttachmentCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid AttachmentId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public Guid? ActivityTaskId => TaskId;
    public string ActivityVerb => "removed attachment";
    public string ActivityLabel => "file";
}

public sealed class DeleteTaskAttachmentCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteTaskAttachmentCommand>
{
    public async Task Handle(
        DeleteTaskAttachmentCommand command,
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

        var attachment = await taskAttachmentRepository.GetByIdAsync(command.AttachmentId, cancellationToken);
        if (attachment is null || attachment.TaskItemId != command.TaskId)
        {
            throw new NotFoundException(nameof(TaskAttachment), command.AttachmentId);
        }

        await taskAttachmentRepository.RemoveAsync(attachment, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
