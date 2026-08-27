using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Create;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CreateProjectCommand(
    Guid WorkspaceId,
    string Name,
    string Key,
    string? Description,
    string? Emoji = null,
    string? CoverColor = null) : IRequest<Guid>, IWorkspaceRequest, IWorkspaceEvent;
