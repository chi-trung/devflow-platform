namespace DevFlow.Api.Contracts.Projects;

public sealed record CreateProjectRequest(
    string Name,
    string Key,
    string? Description,
    string? Emoji = null,
    string? CoverColor = null);

public sealed record ProjectCreatedResponse(Guid Id);

public sealed record UpdateProjectRequest(
    string Name,
    string? Description,
    string? Emoji = null,
    string? CoverColor = null);
