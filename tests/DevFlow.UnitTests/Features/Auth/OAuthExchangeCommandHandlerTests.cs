using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.OAuth;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class OAuthExchangeCommandHandlerTests
{
    private readonly IExternalIdentityProvider _identityProvider = Substitute.For<IExternalIdentityProvider>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ISocialLoginRepository _socialLoginRepository = Substitute.For<ISocialLoginRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
    private readonly ITokenProvider _tokenProvider = Substitute.For<ITokenProvider>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly OAuthExchangeCommandHandler _handler;

    public OAuthExchangeCommandHandlerTests()
    {
        _identityProvider.Provider.Returns("google");
        _handler = new OAuthExchangeCommandHandler(
            new[] { _identityProvider },
            _userRepository,
            _socialLoginRepository,
            _refreshTokenRepository,
            _tokenProvider,
            _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldCreateUserAndLink_WhenGoogleAccountIsNew()
    {
        _identityProvider.GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("google-sub-123", "new@google.com", "New User"));
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>())
            .Returns("access-token");
        _tokenProvider.GenerateRefreshToken()
            .Returns("refresh-token");

        var command = new OAuthExchangeCommand("google", "code-abc", "verifier-xyz");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        Assert.Equal("refresh-token", response.RefreshToken);
        await _userRepository.Received(1).AddAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>());
        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s => s.Provider == "google" && s.Subject == "google-sub-123"),
            Arg.Any<CancellationToken>());
        await _refreshTokenRepository.Received(1).AddAsync(Arg.Any<Domain.Entities.RefreshToken>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldLinkExistingEmailAccount_WhenSameEmailAlreadyRegistered()
    {
        var existing = Domain.Entities.User.Create("existing@google.com", "existing", "hash", "Existing");
        _identityProvider.GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("google-sub-456", "existing@google.com", "Existing"));
        _socialLoginRepository.GetByProviderAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.SocialLogin?)null);
        _userRepository.GetByEmailAsync("existing@google.com", Arg.Any<CancellationToken>())
            .Returns(existing);
        _tokenProvider.GenerateAccessToken(existing).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new OAuthExchangeCommand("google", "code-abc", "verifier-xyz");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        // No new user created — the existing email account is linked instead.
        await _userRepository.DidNotReceive().AddAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>());
        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s => s.UserId == existing.Id && s.Provider == "google"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldSignInExistingLink_WhenAlreadyLinked()
    {
        var existing = Domain.Entities.User.Create("linked@google.com", "linked", "hash", "Linked");
        var login = Domain.Entities.SocialLogin.Create(existing.Id, "google", "google-sub-789");
        _identityProvider.GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("google-sub-789", "linked@google.com", "Linked"));
        _socialLoginRepository.GetByProviderAsync("google", "google-sub-789", Arg.Any<CancellationToken>())
            .Returns(login);
        _userRepository.GetByIdAsync(login.UserId, Arg.Any<CancellationToken>())
            .Returns(existing);
        _tokenProvider.GenerateAccessToken(existing).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new OAuthExchangeCommand("google", "code-abc", "verifier-xyz");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        // Already linked — no new user, no new link, just a session.
        await _userRepository.DidNotReceive().AddAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>());
        await _socialLoginRepository.DidNotReceive().AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldNormalizeEmail_WhenCreatingUser()
    {
        Domain.Entities.User? created = null;
        _identityProvider.GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("google-sub-111", "  MiXeD@Google.COM ", "Mixed"));
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);
        _userRepository
            .When(u => u.AddAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>()))
            .Do(ci => created = ci.Arg<Domain.Entities.User>());
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>()).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new OAuthExchangeCommand("GOOGLE", "code-abc", "verifier-xyz");

        await _handler.Handle(command, CancellationToken.None);

        Assert.NotNull(created);
        Assert.Equal("mixed@google.com", created!.Email);
        Assert.Equal("mixed", created.Username);
    }

    [Fact]
    public async Task Handle_ShouldCreateUserAndLink_WhenGitHubAccountIsNew()
    {
        _identityProvider.Provider.Returns("github");
        _identityProvider.GetProfileAsync("github", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("github-sub-1", "new@users.noreply.github.com", "GH User", "gho_test_token"));
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>())
            .Returns("access-token");
        _tokenProvider.GenerateRefreshToken()
            .Returns("refresh-token");

        var command = new OAuthExchangeCommand("github", "code-abc", "unused-verifier");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        await _userRepository.Received(1).AddAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>());
        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s =>
                s.Provider == "github"
                && s.Subject == "github-sub-1"
                && s.AccessToken == "gho_test_token"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldUpdateStoredToken_WhenGitHubLinkExists()
    {
        _identityProvider.Provider.Returns("github");
        var existing = Domain.Entities.User.Create("linked@users.noreply.github.com", "linked", "hash", "Linked");
        var login = Domain.Entities.SocialLogin.Create(existing.Id, "github", "github-sub-2", "gho_old_token");
        _identityProvider.GetProfileAsync("github", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("github-sub-2", "linked@users.noreply.github.com", "Linked", "gho_new_token"));
        _socialLoginRepository.GetByProviderAsync("github", "github-sub-2", Arg.Any<CancellationToken>())
            .Returns(login);
        _userRepository.GetByIdAsync(login.UserId, Arg.Any<CancellationToken>())
            .Returns(existing);
        _tokenProvider.GenerateAccessToken(existing).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new OAuthExchangeCommand("github", "code-abc", "unused-verifier");

        await _handler.Handle(command, CancellationToken.None);

        // Re-login refreshes the stored token in place — no new link row.
        Assert.Equal("gho_new_token", login.AccessToken);
        await _socialLoginRepository.DidNotReceive().AddAsync(Arg.Any<Domain.Entities.SocialLogin>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldStoreNullToken_WhenProviderOmitsToken()
    {
        _identityProvider.GetProfileAsync("google", Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(new ExternalIdentity("google-sub-222", "notoken@google.com", "No Token"));
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>())
            .Returns("access-token");
        _tokenProvider.GenerateRefreshToken()
            .Returns("refresh-token");

        var command = new OAuthExchangeCommand("google", "code-abc", "verifier-xyz");

        await _handler.Handle(command, CancellationToken.None);

        // Google's token is discarded — the stored token stays null.
        await _socialLoginRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.SocialLogin>(s => s.AccessToken == null),
            Arg.Any<CancellationToken>());
    }
}
