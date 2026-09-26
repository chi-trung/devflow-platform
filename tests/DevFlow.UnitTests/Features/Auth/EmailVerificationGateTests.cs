using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Application.Features.Auth.Refresh;
using DevFlow.Application.Features.Auth.VerifyEmail;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

/// <summary>
/// The gate that keeps an unverified account out of the app.
///
/// These are the three paths that can put a token in someone's hands. If any
/// one of them stops checking <c>IsEmailVerified</c>, the whole feature is
/// cosmetic — so each one is pinned here rather than left to a manual test.
/// </summary>
public class EmailVerificationGateTests
{
    private static User CreateUser(bool verified)
    {
        var user = User.Create("dev@test.io", "devuser", "hash", "Dev User");
        if (verified)
        {
            user.MarkEmailVerified();
        }

        return user;
    }

    [Fact]
    public async Task Login_ShouldReject_WhenEmailNotVerified()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        userRepository.GetByEmailAsync("dev@test.io", Arg.Any<CancellationToken>()).Returns(CreateUser(false));
        passwordHasher.Verify("Sup3rSecret!", Arg.Any<string>()).Returns(true);

        var handler = new LoginCommandHandler(
            userRepository, refreshTokenRepository, unitOfWork, passwordHasher, tokenProvider);

        var command = new LoginCommand("dev@test.io", "Sup3rSecret!");

        await Assert.ThrowsAsync<EmailNotVerifiedException>(
            () => handler.Handle(command, CancellationToken.None));

        // No token may be minted or persisted for a blocked sign-in.
        await refreshTokenRepository.DidNotReceive()
            .AddAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>());
        tokenProvider.DidNotReceive().GenerateAccessToken(Arg.Any<User>());
    }

    [Fact]
    public async Task Login_ShouldSucceed_WhenEmailVerified()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        userRepository.GetByEmailAsync("dev@test.io", Arg.Any<CancellationToken>()).Returns(CreateUser(true));
        passwordHasher.Verify("Sup3rSecret!", Arg.Any<string>()).Returns(true);
        tokenProvider.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var handler = new LoginCommandHandler(
            userRepository, refreshTokenRepository, unitOfWork, passwordHasher, tokenProvider);

        var response = await handler.Handle(
            new LoginCommand("dev@test.io", "Sup3rSecret!"), CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
    }

    [Fact]
    public async Task Refresh_ShouldRejectAndRevokeStoredToken_WhenUserNotVerified()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        var user = CreateUser(false);
        var storedToken = RefreshToken.Create(user.Id, "stored-refresh", DateTimeOffset.UtcNow.AddDays(1));

        refreshTokenRepository
            .GetByTokenAsync("stored-refresh", Arg.Any<CancellationToken>())
            .Returns(storedToken);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);

        var handler = new RefreshCommandHandler(
            refreshTokenRepository, userRepository, unitOfWork, tokenProvider);

        await Assert.ThrowsAsync<EmailNotVerifiedException>(
            () => handler.Handle(new RefreshCommand("stored-refresh"), CancellationToken.None));

        // The stolen token is burned, not merely refused: leaving it active
        // would let a caller retry forever.
        Assert.False(storedToken.IsActive);
        await refreshTokenRepository.DidNotReceive()
            .AddAsync(Arg.Any<RefreshToken>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task VerifyEmail_ShouldReturnSession_WhenTokenIsValid()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();
        var verificationTokenProvider = Substitute.For<IEmailVerificationTokenProvider>();

        var user = CreateUser(false);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        verificationTokenProvider.Validate("good-token").Returns(user.Id);
        tokenProvider.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var handler = new VerifyEmailCommandHandler(
            userRepository, verificationTokenProvider, refreshTokenRepository, unitOfWork, tokenProvider);

        var response = await handler.Handle(
            new VerifyEmailCommand("good-token"), CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        Assert.True(user.IsEmailVerified);
    }

    /// <summary>
    /// Clicking an old link twice must not fail. Mail scanners routinely
    /// pre-fetch links, so this is the normal case, not an edge case.
    /// </summary>
    [Fact]
    public async Task VerifyEmail_ShouldSucceed_WhenAlreadyVerified()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();
        var verificationTokenProvider = Substitute.For<IEmailVerificationTokenProvider>();

        var user = CreateUser(true);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        verificationTokenProvider.Validate("good-token").Returns(user.Id);
        tokenProvider.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var handler = new VerifyEmailCommandHandler(
            userRepository, verificationTokenProvider, refreshTokenRepository, unitOfWork, tokenProvider);

        var response = await handler.Handle(
            new VerifyEmailCommand("good-token"), CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
    }

    [Fact]
    public async Task VerifyEmail_ShouldReject_WhenTokenIsInvalid()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();
        var verificationTokenProvider = Substitute.For<IEmailVerificationTokenProvider>();

        // Expired, forged, or a session token pasted from devtools — all three
        // collapse to the same null from the provider.
        verificationTokenProvider.Validate(Arg.Any<string>()).Returns((Guid?)null);

        var handler = new VerifyEmailCommandHandler(
            userRepository, verificationTokenProvider, refreshTokenRepository, unitOfWork, tokenProvider);

        await Assert.ThrowsAsync<ValidationException>(
            () => handler.Handle(new VerifyEmailCommand("nope"), CancellationToken.None));
    }
}
