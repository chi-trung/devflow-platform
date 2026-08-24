namespace DevFlow.Application.Features.Outbox;

public sealed record DeadLetterMessageDto(
    Guid Id,
    string Type,
    DateTimeOffset OccurredAtUtc,
    DateTimeOffset? ProcessedAtUtc,
    int RetryCount,
    string? Error,
    DateTimeOffset FailedPermanentlyAt);
