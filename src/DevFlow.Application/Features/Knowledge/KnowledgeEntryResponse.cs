namespace DevFlow.Application.Features.Knowledge;

public sealed record KnowledgeEntryResponse(
    Guid Id,
    Guid ProjectId,
    Guid? TaskId,
    string Title,
    string? Body,
    string Type,
    string Status,
    decimal Weight,
    string? Tags,
    Guid? SupersededById,
    bool NeedsReview,
    string? DriftReason,
    DateTimeOffset? DriftedAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc);
