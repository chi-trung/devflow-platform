namespace DevFlow.Application.Features.ProjectMembers;

public sealed record ProjectMemberResponse(
    Guid UserId,
    string Username,
    string DisplayName,
    string Role);
