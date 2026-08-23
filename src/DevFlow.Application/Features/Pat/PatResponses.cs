namespace DevFlow.Application.Features.Pat;

public sealed record PatResponse(
    Guid Id,
    string Name,
    IReadOnlyList<string> Scopes,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? LastUsedAtUtc);

public sealed record PatCreatedResponse(
    Guid Id,
    string Token);
