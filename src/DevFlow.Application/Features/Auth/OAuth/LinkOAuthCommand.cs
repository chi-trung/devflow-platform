using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.OAuth;

/// <summary>
/// Attaches an external identity to the account that is already signed in.
/// Distinct from <see cref="OAuthExchangeCommand"/>, which is anonymous and
/// identifies the caller by whatever the provider says — the whole difference
/// is whose account the identity lands on.
/// </summary>
public sealed record LinkOAuthCommand(
    Guid UserId,
    string Provider,
    string Code,
    string CodeVerifier) : IRequest<LinkedAccountsResponse>;

public sealed class LinkOAuthCommandHandler(
    IEnumerable<IExternalIdentityProvider> identityProviders,
    IUserRepository userRepository,
    ISocialLoginRepository socialLoginRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<LinkOAuthCommand, LinkedAccountsResponse>
{
    public async Task<LinkedAccountsResponse> Handle(
        LinkOAuthCommand command,
        CancellationToken cancellationToken)
    {
        var provider = command.Provider.Trim().ToLowerInvariant();
        var identityProvider = identityProviders.FirstOrDefault(p =>
            string.Equals(p.Provider, provider, StringComparison.OrdinalIgnoreCase))
            ?? throw new UnauthorizedAccessException($"Unsupported OAuth provider: {provider}.");

        // The provider is the only party that can prove who this person is. We
        // never take the account id from the request body — it comes from the
        // signed token via userContext, so a caller cannot link a provider onto
        // somebody else's account.
        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.User), command.UserId);

        var identity = await identityProvider.GetProfileAsync(
            provider,
            command.Code,
            command.CodeVerifier,
            cancellationToken);

        // The conflict check. This is the whole reason linking is not just the
        // exchange path with a different target: (provider, subject) is a
        // globally unique identity, and a row already holding it belongs to
        // whoever linked it first. Without this check, anyone signed in could
        // link a provider identity that somebody else owns and then sign in as
        // that account — a fresh account-takeover route with a valid session as
        // the only requirement.
        var existing = await socialLoginRepository.GetByProviderAsync(
            provider,
            identity.Subject,
            cancellationToken);

        if (existing is not null && existing.UserId != user.Id)
        {
            // Deliberately not naming the other account. "That Google is
            // already linked elsewhere" is enough for the person to
            // understand; who it belongs to is none of their business.
            throw new ConflictException(
                $"That {provider} account is already linked to a different DevFlow account.");
        }

        // Already linked to this account. Idempotent on purpose: the person
        // may double-click, or retry after a dropped response, and a second
        // attempt must not fail on what is already true.
        if (existing is not null)
        {
            existing.UpdateAccessToken(identity.AccessToken);

            if (!string.IsNullOrWhiteSpace(identity.AvatarUrl))
            {
                user.UpdateAvatarUrl(identity.AvatarUrl);
            }

            await AttachEmailAsync(user, identity.Email, userRepository, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await BuildResponseAsync(user, cancellationToken);
        }

        // A provider may already be linked to this account under a *different*
        // subject — they signed up with one Google and are now linking another.
        // Only one identity per provider per account, or the account would have
        // several ways in and no way to tell which one to remove.
        if (await socialLoginRepository.ExistsForUserAsync(user.Id, provider, cancellationToken))
        {
            throw new ConflictException(
                $"A different {provider} account is already linked to this account.");
        }

        // Every check first, then every write. The email collision below is
        // detected here rather than at flush time, so it is one step earlier
        // than it strictly has to be — but ordering it first means a refused
        // link leaves the account completely untouched, with no half-built
        // SocialLogin sitting in the change tracker if the throw ever moved.
        await EnsureEmailAvailableAsync(user, identity.Email, userRepository, cancellationToken);

        await socialLoginRepository.AddAsync(
            SocialLogin.Create(user.Id, provider, identity.Subject, identity.AccessToken),
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(identity.AvatarUrl))
        {
            user.UpdateAvatarUrl(identity.AvatarUrl);
        }

        AttachEmail(user, identity.Email);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return await BuildResponseAsync(user, cancellationToken);
    }

    /// <summary>
    /// Gives the account the address the provider just proved, when it has
    /// none. This is the point of the whole flow: an account with no address
    /// cannot be recovered, so linking a provider is what makes the password
    /// forgettable instead of fatal.
    /// </summary>
    private static async Task AttachEmailAsync(
        Domain.Entities.User user,
        string email,
        IUserRepository userRepository,
        CancellationToken cancellationToken)
    {
        if (ShouldAttachEmail(user, email))
        {
            await EnsureEmailAvailableAsync(user, email, userRepository, cancellationToken);
            AttachEmail(user, email);
        }
    }

    private static void AttachEmail(Domain.Entities.User user, string email)
    {
        if (ShouldAttachEmail(user, email))
        {
            user.AttachEmail(email.Trim().ToLowerInvariant());
        }
    }

    private static bool ShouldAttachEmail(Domain.Entities.User user, string email)
        => !string.IsNullOrWhiteSpace(email) && user.Email is null;

    /// <summary>
    /// Refuses an address some other account already holds.
    ///
    /// Checked before writing rather than left to the unique index, which would
    /// reject the flush and surface to the caller as an opaque 500 with no way
    /// to tell what collided. It matters most here because a Google or GitHub
    /// address is not chosen by us — a legitimate person can link a provider
    /// whose address is already in the system, and the honest answer is "that
    /// one is taken", not a crash.
    /// </summary>
    private static async Task EnsureEmailAvailableAsync(
        Domain.Entities.User user,
        string email,
        IUserRepository userRepository,
        CancellationToken cancellationToken)
    {
        if (!ShouldAttachEmail(user, email))
        {
            return;
        }

        if (await userRepository.ExistsByEmailExceptIdAsync(
                email.Trim().ToLowerInvariant(), user.Id, cancellationToken))
        {
            throw new ConflictException(
                "That email address is already used by a different DevFlow account.");
        }
    }

    private async Task<LinkedAccountsResponse> BuildResponseAsync(
        Domain.Entities.User user,
        CancellationToken cancellationToken)
    {
        var providers = await userRepository.GetLinkedProvidersAsync(user.Id, cancellationToken);
        return new LinkedAccountsResponse(providers, user.Email, user.CanBeRecovered);
    }
}
