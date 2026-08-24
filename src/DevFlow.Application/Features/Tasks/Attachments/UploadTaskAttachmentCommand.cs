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
    private const long MaxFileSize = 10 * 1024 * 1024; // 10 MB

    private static readonly string[] AllowedContentTypes =
    [
        "image/",
        "application/pdf",
        "text/",
        "application/json",
        "application/vnd.openxmlformats-officedocument.",
        "application/vnd.ms-excel",
        "application/msword",
    ];

    private static readonly string[] BlockedExtensions =
    [
        ".exe", ".dll", ".bat", ".sh", ".cmd", ".ps1", ".js", ".vbs", ".scr", ".msi", ".com", ".jar",
    ];

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

        ValidateFile(command);

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

    private static void ValidateFile(UploadTaskAttachmentCommand command)
    {
        if (command.FileSize <= 0 || command.Data.Length == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = ["File is empty."],
            });
        }

        if (command.FileSize > MaxFileSize)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = [$"File exceeds the {MaxFileSize / 1024 / 1024} MB size limit."],
            });
        }

        var extension = Path.GetExtension(command.FileName).ToLowerInvariant();
        if (BlockedExtensions.Contains(extension))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = [$"File type '{extension}' is not allowed for security reasons."],
            });
        }

        var contentType = command.ContentType.ToLowerInvariant();
        var allowed = AllowedContentTypes.Any(prefix => contentType.StartsWith(prefix, StringComparison.Ordinal));
        if (!allowed)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["File"] = [$"File type '{command.ContentType}' is not allowed. Allowed: images, PDF, text, JSON, Office documents."],
            });
        }
    }
}
