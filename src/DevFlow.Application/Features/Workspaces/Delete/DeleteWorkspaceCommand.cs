using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Delete;

[RequireWorkspaceRole(WorkspaceRole.Owner)]
public sealed record DeleteWorkspaceCommand(
    Guid WorkspaceId) : IRequest, IWorkspaceRequest;
