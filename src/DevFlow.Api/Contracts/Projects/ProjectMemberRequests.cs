using DevFlow.Domain.Enums;

namespace DevFlow.Api.Contracts.Projects;

public sealed record AddProjectMemberRequest(Guid UserId, ProjectRole Role);

public sealed record UpdateProjectMemberRoleRequest(ProjectRole Role);
