using MediatR;

namespace DevFlow.Application.Features.Auth.DeleteAccount;

/// <summary>
/// Deletes the signed-in account outright. There is exactly one field because
/// there is exactly one possible target: the id comes from the access token,
/// so nothing in the request body could aim this at somebody else's account.
/// </summary>
public sealed record DeleteAccountCommand(Guid UserId) : IRequest;
