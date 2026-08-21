namespace DevFlow.Api.Contracts.Projects;

public sealed record CreateProjectRequest(
    string Name,
    string Key,
    string? Description);

public sealed record ProjectCreatedResponse(Guid Id);
