using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Auth.OAuth;

/// <param name="Providers">Providers this account has linked, e.g. ["google"].</param>
/// <param name="Email">The account's address, or null if it has none.</param>
/// <param name="CanBeRecovered">
/// Whether a lost password can be recovered at all. False means the only way
/// back in is a linked provider — the dashboard prompt exists to change this.
/// </param>
public sealed record LinkedAccountsResponse(
    IReadOnlyList<string> Providers,
    string? Email,
    bool CanBeRecovered);

/// <summary>
/// Reports what this account can do to get back in, so the dashboard can warn
/// about an unrecoverable one.
///
/// Read from a dedicated endpoint rather than a JWT claim on purpose: a claim
/// is frozen when the token is issued, so someone who links a Google would keep
/// seeing "not linked yet" until their token expired. The banner is exactly the
/// thing that changes state, so it must not be cached in the credential.
/// </summary>
public sealed record GetLinkedAccountsQuery(Guid UserId) : IRequest<LinkedAccountsResponse>;

public sealed class GetLinkedAccountsQueryHandler(
    IUserRepository userRepository) : IRequestHandler<GetLinkedAccountsQuery, LinkedAccountsResponse>
{
    public async Task<LinkedAccountsResponse> Handle(
        GetLinkedAccountsQuery query,
        CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(query.UserId, cancellationToken)
            ?? throw new Common.Exceptions.NotFoundException(
                nameof(Domain.Entities.User), query.UserId);

        var providers = await userRepository.GetLinkedProvidersAsync(query.UserId, cancellationToken);

        return new LinkedAccountsResponse(providers, user.Email, user.CanBeRecovered);
    }
}
