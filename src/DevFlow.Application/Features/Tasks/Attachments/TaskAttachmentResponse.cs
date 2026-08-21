namespace DevFlow.Application.Features.Tasks.Attachments;

public sealed record TaskAttachmentResponse(
    Guid Id,
    Guid TaskItemId,
    string FileName,
    string ContentType,
    long FileSize,
    DateTimeOffset CreatedAtUtc);
