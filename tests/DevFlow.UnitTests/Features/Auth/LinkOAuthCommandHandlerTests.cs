using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.OAuth;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class LinkOAuthCommandHandlerTests
{
    private readonly IExternalIdentityProvider _identityProvider = Substitute.For<IExternalIdentityProvider>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ISocialLoginRepository _socialLoginRepository = Substitute.For<ISocialLoginRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly LinkOAuthCommandHandler _handler;

    public LinkOAuthCommandHandlerTests()
    {
        _identityProvider.Provider.Returns("google");
        _handler = new LinkOAuthCommandHandler(
            new[] { _identityProvider },
            _userRepository,
            _socialLoginRepository,
            _unitOfWork);
    }

    private void IdentityIs(
        string subject,
        string email,
        string? name = "Linked User",
        string? accessToken = null,
        string? avatarUrl = null)
    {
        _identityProvider
            .GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity(subject, email, name!, accessToken, avatarUrl));
    }

    private void UserHasNoLinks(Domain.Entities.User user)
    {
        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _socialLoginRepository.ExistsForUserAsync(user.Id, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _socialLoginRepository.GetByProviderAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.SocialLogin?)null);
        _userRepository.GetLinkedProvidersAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<string>());
    }

    [Fact]
    public async Task Handle_ShouldLinkAndAttachEmail_WhenAccountHasNoEmail()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        IdentityIs("google-sub-1", "dev@gmail.com");
        _userRepository.ExistsByEmailExceptIdAsync("dev@gmail.com", user.Id, Arg.Any<CancellationToken>())
            .Returns(false);

        var response = await _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None);

        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s =>
                s.UserId == user.Id && s.Provider == "google" && s.Subject == "google-sub-1"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        // The address the provider proved is what makes the account
        // recoverable, so it has to be stored — otherwise linking achieved
        // nothing that the dashboard warning was about.
        Assert.Equal("dev@gmail.com", user.Email);
        Assert.True(user.CanBeRecovered);
        Assert.True(response.CanBeRecovered);
    }

    /// <summary>
    /// The security property this endpoint exists to get right. (provider,
    /// subject) is a globally unique identity. If a signed-in user can link one
    /// that another account already owns, they can then sign in as that account
    /// — account takeover with nothing but a valid session and a stolen
    /// provider code. So this must be refused, not merged.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenProviderIdentityBelongsToAnotherAccount()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        var owner = Domain.Entities.User.CreateWithPassword("owner", "hash", "Owner");
        var someoneElsesLink = Domain.Entities.SocialLogin.Create(owner.Id, "google", "google-sub-shared");

        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _socialLoginRepository.GetByProviderAsync("google", "google-sub-shared", Arg.Any<CancellationToken>())
            .Returns(someoneElsesLink);
        IdentityIs("google-sub-shared", "attacker@gmail.com");

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None));

        // Nothing may be written: not the link, and not the attacker's address
        // being quietly attached to the victim's account.
        await _socialLoginRepository.DidNotReceive()
            .AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        Assert.Null(user.Email);
    }

    /// <summary>
    /// The conflict message must not say whose account it is. "Already linked"
    /// tells the person enough to fix their problem; naming the other account
    /// would turn this into a way to discover which identities are registered.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldNotNameTheOtherAccount_WhenProviderIsAlreadyLinked()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        var owner = Domain.Entities.User.CreateWithPassword("owner", "hash", "Owner");
        var someoneElsesLink = Domain.Entities.SocialLogin.Create(owner.Id, "google", "google-sub-shared");

        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _socialLoginRepository.GetByProviderAsync("google", "google-sub-shared", Arg.Any<CancellationToken>())
            .Returns(someoneElsesLink);
        IdentityIs("google-sub-shared", "attacker@gmail.com");

        var error = await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None));

        Assert.DoesNotContain(owner.Username, error.Message);
        Assert.DoesNotContain(owner.Id.ToString(), error.Message);
    }

    /// <summary>
    /// Clicking twice, or retrying after a dropped response, must not fail on
    /// something that is already true. Without this the banner's second tap
    /// shows an error for an account that is perfectly fine.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldBeIdempotent_WhenAlreadyLinkedToThisAccount()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        user.AttachEmail("dev@gmail.com");
        var existing = Domain.Entities.SocialLogin.Create(user.Id, "google", "google-sub-1", "old-token");

        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _socialLoginRepository.GetByProviderAsync("google", "google-sub-1", Arg.Any<CancellationToken>())
            .Returns(existing);
        _userRepository.GetLinkedProvidersAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { "google" });
        IdentityIs("google-sub-1", "dev@gmail.com", accessToken: "fresh-token");

        var response = await _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None);

        await _socialLoginRepository.DidNotReceive()
            .AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        // The stored token is still refreshed — GitHub issues a new one per
        // authorization and the account may depend on it.
        Assert.Equal("fresh-token", existing.AccessToken);
        Assert.Equal(new[] { "google" }, response.Providers);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenAccountAlreadyLinkedADifferentIdentity()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        _socialLoginRepository.ExistsForUserAsync(user.Id, "google", Arg.Any<CancellationToken>())
            .Returns(true);
        IdentityIs("google-sub-second", "other@gmail.com");

        var error = await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None));

        Assert.Contains("already linked", error.Message);
        await _socialLoginRepository.DidNotReceive()
            .AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenEmailAlreadyBelongsToAnotherAccount()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        IdentityIs("google-sub-1", "taken@gmail.com");
        _userRepository.ExistsByEmailExceptIdAsync("taken@gmail.com", user.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None));

        await _socialLoginRepository.DidNotReceive()
            .AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
        Assert.Null(user.Email);
    }

    /// <summary>
    /// The user already had an address, and the provider reports a different
    /// one. Overwriting it would silently re-point the account's recovery
    /// route at a mailbox the person may not own, so the existing one stands
    /// and the link still succeeds — the provider link is worth having on its
    /// own.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldKeepExistingEmail_WhenProviderReportsADifferentOne()
    {
        var user = Domain.Entities.User.Create("first@gmail.com", "devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        IdentityIs("google-sub-1", "second@gmail.com");

        await _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None);

        Assert.Equal("first@gmail.com", user.Email);
        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldStoreAvatar_WhenProviderReturnsOne()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        IdentityIs("google-sub-1", "dev@gmail.com", avatarUrl: "https://example.com/pic.png");

        await _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None);

        Assert.Equal("https://example.com/pic.png", user.AvatarUrl);
    }

    [Fact]
    public async Task Handle_ShouldRejectUnknownProvider()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => _handler.Handle(
            new LinkOAuthCommand(user.Id, "facebook", "code", "verifier"),
            CancellationToken.None));
    }

    /// <summary>
    /// A provider that reports no usable address must still let the link
    /// through. GitHub hides the address behind a privacy setting, so this is a
    /// real shape for a real person — and the link is worth having on its own,
    /// since it is a way back into the account regardless.
    ///
    /// What must NOT happen is a crash: <c>ExternalIdentity.Email</c> is typed
    /// non-nullable but nothing at the HTTP boundary guarantees it, and an
    /// unhandled null here would surface as a 500 on the banner.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldStillLink_WhenProviderReportsNoEmail()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        UserHasNoLinks(user);
        IdentityIs("github-sub-1", "   ");

        var response = await _handler.Handle(
            new LinkOAuthCommand(user.Id, "google", "code", "verifier"),
            CancellationToken.None);

        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s => s.Subject == "github-sub-1"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        Assert.Null(user.Email);
        Assert.False(response.CanBeRecovered);
    }
}
