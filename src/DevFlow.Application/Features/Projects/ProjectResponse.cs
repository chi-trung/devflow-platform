namespace DevFlow.Application.Features.Projects;

public sealed record ProjectResponse(
    Guid Id,
    string Name,
    string Key,
    string? Description,
    string Status);
