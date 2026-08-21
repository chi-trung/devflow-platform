namespace DevFlow.Application.Features.Comments;

public sealed record CommentResponse(
    Guid Id,
    Guid TaskItemId,
    Guid AuthorId,
    string Content,
    DateTimeOffset CreatedAtUtc);
