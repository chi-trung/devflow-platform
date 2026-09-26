using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Auth.OAuth;

/// <summary>
/// Detaches an external identity from the account that is already signed in.
/// The mirror of <see cref="LinkOAuthCommand"/>: same trust model (the target
/// comes from the token, never the body), opposite direction.
/// </summary>
public sealed record UnlinkOAuthCommand(
    Guid UserId,
    string Provider) : IRequest<LinkedAccountsResponse>;

public sealed class UnlinkOAuthCommandHandler(
    IUserRepository userRepository,
    ISocialLoginRepository socialLoginRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UnlinkOAuthCommand, LinkedAccountsResponse>
{
    public async Task<LinkedAccountsResponse> Handle(
        UnlinkOAuthCommand command,
        CancellationToken cancellationToken)
    {
        var provider = command.Provider.Trim().ToLowerInvariant();

        // A provider name we do not recognise is a client bug or a probe, not a
        // missing link. Answering "not linked" for one would let a caller learn
        // nothing while silently doing nothing, which is how a UI ends up
        // showing a "removed" state that never changed.
        if (provider is not ("google" or "github"))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["provider"] = [$"Supported providers are google and github; got '{provider}'."],
            });
        }

        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.User), command.UserId);

        if (!await socialLoginRepository.ExistsForUserAsync(user.Id, provider, cancellationToken))
        {
            throw new NotFoundException(nameof(Domain.Entities.SocialLogin), provider);
        }

        // The refusal that matters. Unlinking the last provider from an account
        // with no address leaves an account whose password is the only key to
        // it — recoverable right up until that password is lost, and there is no
        // mail to send a reset to. That is the state the dashboard warns about,
        // and it must be a deliberate choice: the person either links something
        // else first, or accepts it by confirming.
        if (user.CanBeRecovered)
        {
            await socialLoginRepository.RemoveByProviderAsync(user.Id, provider, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return await BuildResponseAsync(user, cancellationToken);
        }

        throw new ConflictException(
            "This is the only way back into this account. Link another provider, " +
            "or add an email address, before removing it.");
    }

    private async Task<LinkedAccountsResponse> BuildResponseAsync(
        Domain.Entities.User user,
        CancellationToken cancellationToken)
    {
        var providers = await userRepository.GetLinkedProvidersAsync(user.Id, cancellationToken);
        return new LinkedAccountsResponse(providers, user.Email, user.CanBeRecovered);
    }
}
