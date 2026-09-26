using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Application.Features.Auth.Refresh;
using DevFlow.Application.Features.Auth.VerifyEmail;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

/// <summary>
/// The token-issuing paths, after the verification gate was removed.
///
/// Registration no longer collects an email, so there is nothing to verify and
/// an account is usable the moment it is created. That decision removes a gate
/// — which is only safe if each path that used to enforce it is checked here,
/// because a half-removed gate locks out the people who signed up the normal
/// way rather than protecting anyone. These tests are the record that the
/// absence is deliberate.
/// </summary>
public class EmailVerificationGateTests
{
    [Fact]
    public async Task Login_ShouldSucceed_WhenAccountHasNoEmail()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        var user = User.CreateWithPassword("devuser", "hash", "Dev User");
        userRepository.GetByUsernameAsync("devuser", Arg.Any<CancellationToken>()).Returns(user);
        passwordHasher.Verify("Sup3rSecret!", Arg.Any<string>()).Returns(true);
        tokenProvider.GenerateAccessToken(Arg.Any<User>()).Returns("access-token");
        tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var handler = new LoginCommandHandler(
            userRepository, refreshTokenRepository, unitOfWork, passwordHasher, tokenProvider);

        var response = await handler.Handle(
            new LoginCommand("devuser", "Sup3rSecret!"), CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
    }

    /// <summary>
    /// The gate used to live here as well, and it was the more dangerous of
    /// the two: login had just issued a session, so a refresh check would only
    /// fire once the access token expired — signing every accountless user out
    /// after a few minutes, with no way back in. Pinned so the two paths can
    /// never disagree again.
    /// </summary>
    [Fact]
    public async Task Refresh_ShouldRotateAndSucceed_WhenAccountHasNoEmail()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        var user = User.CreateWithPassword("devuser", "hash", "Dev User");
        var storedToken = RefreshToken.Create(user.Id, "stored-refresh", DateTimeOffset.UtcNow.AddDays(1));

        refreshTokenRepository
            .GetByTokenAsync("stored-refresh", Arg.Any<CancellationToken>())
            .Returns(storedToken);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        tokenProvider.GenerateAccessToken(Arg.Any<User>()).Returns("new-access-token");
        tokenProvider.GenerateRefreshToken().Returns("new-refresh-token");

        var handler = new RefreshCommandHandler(
            refreshTokenRepository, userRepository, unitOfWork, tokenProvider);

        var response = await handler.Handle(
            new RefreshCommand("stored-refresh"), CancellationToken.None);

        Assert.Equal("new-access-token", response.AccessToken);

        // The old token is burned by the rotation, as it always was. A gate
        // here would have revoked it instead and thrown, which is what made
        // the unverified path unrecoverable.
        Assert.False(storedToken.IsActive);
    }

    [Fact]
    public async Task Refresh_ShouldReject_WhenTokenIsAlreadyRevoked()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        var user = User.CreateWithPassword("devuser", "hash", "Dev User");
        var storedToken = RefreshToken.Create(user.Id, "old-refresh", DateTimeOffset.UtcNow.AddDays(1));
        storedToken.Revoke(DateTimeOffset.UtcNow);

        refreshTokenRepository
            .GetByTokenAsync("old-refresh", Arg.Any<CancellationToken>())
            .Returns(storedToken);

        var handler = new RefreshCommandHandler(
            refreshTokenRepository, userRepository, unitOfWork, tokenProvider);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => handler.Handle(new RefreshCommand("old-refresh"), CancellationToken.None));

        // A revoked token is a spent key. Reissuing from it is exactly how a
        // session that was logged out of comes back to life.
        tokenProvider.DidNotReceive().GenerateAccessToken(Arg.Any<User>());
    }

    [Fact]
    public async Task VerifyEmail_ShouldReturnSession_WhenTokenIsValid()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var tokenProvider = Substitute.For<ITokenProvider>();
        var verificationTokenProvider = Substitute.For<IEmailVerificationTokenProvider>();

        var user = User.Create("dev@test.io", "devuser", "hash", "Dev User");
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

        var user = User.Create("dev@test.io", "devuser", "hash", "Dev User");
        user.MarkEmailVerified();
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
