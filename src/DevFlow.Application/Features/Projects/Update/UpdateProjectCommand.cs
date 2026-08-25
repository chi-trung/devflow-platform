using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Update;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateProjectCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Name,
    string? Description,
    string? Emoji = null,
    string? CoverColor = null) : IRequest, IWorkspaceRequest;
