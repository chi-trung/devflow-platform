using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.RevokeInvitation;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record RevokeInvitationCommand(Guid WorkspaceId, Guid InvitationId)
    : IRequest, IWorkspaceRequest;
