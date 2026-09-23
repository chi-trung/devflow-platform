using MediatR;

namespace DevFlow.Application.Features.Workspaces.DeclineInvitation;

// Authenticated only — invitee is not a member yet (see AcceptInvitationCommand).
public sealed record DeclineInvitationCommand(Guid InvitationId) : IRequest;
