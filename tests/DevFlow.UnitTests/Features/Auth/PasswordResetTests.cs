using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.ForgotPassword;
using DevFlow.Application.Features.Auth.ResetPassword;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

/// <summary>
/// The paths that hand out and redeem a password reset token.
///
/// Two properties carry the whole feature, so they are pinned here rather than
/// left to a manual pass: the request endpoint never reveals whether an address
/// is registered, and a token works exactly once.
/// </summary>
public class PasswordResetTests
{
    private const string Email = "dev@test.io";

    private static User CreateUser()
    {
        return User.Create(Email, "devuser", "hash", "Dev User");
    }

    private static PasswordResetToken CreateLiveToken(Guid userId)
    {
        return PasswordResetToken.Create(
            userId,
            PasswordResetTokenHasher.Hash("dfpr_live"),
            DateTimeOffset.UtcNow.AddMinutes(30));
    }

    [Fact]
    public async Task ForgotPassword_ShouldLookIdentical_WhenAddressIsUnknown()
    {
        var userRepository = Substitute.For<IUserRepository>();
        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();

        userRepository.GetByEmailAsync(Email, Arg.Any<CancellationToken>()).Returns((User?)null);

        var handler = new ForgotPasswordCommandHandler(
            userRepository,
            resetTokenRepository,
            Substitute.For<DevFlow.Application.Features.Email.IEmailService>(),
            Substitute.For<IPasswordResetTokenGenerator>(),
            Substitute.For<IPasswordResetLinkBuilder>(),
            unitOfWork,
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ForgotPasswordCommandHandler>>());

        // No throw and no token: the reply must be indistinguishable from the
        // case where the address is registered.
        await handler.Handle(new ForgotPasswordCommand(Email), CancellationToken.None);

        await resetTokenRepository.DidNotReceive()
            .AddAsync(Arg.Any<PasswordResetToken>(), Arg.Any<CancellationToken>());
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ForgotPassword_ShouldRevokePreviousTokens_WhenIssuingANewOne()
    {
        var user = CreateUser();
        var previous = CreateLiveToken(user.Id);
        var previousRevokedAt = previous.RevokedAtUtc;

        var userRepository = Substitute.For<IUserRepository>();
        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var tokenGenerator = Substitute.For<IPasswordResetTokenGenerator>();
        var linkBuilder = Substitute.For<IPasswordResetLinkBuilder>();
        var emailService = Substitute.For<DevFlow.Application.Features.Email.IEmailService>();
        var unitOfWork = Substitute.For<IUnitOfWork>();

        userRepository.GetByEmailAsync(Email, Arg.Any<CancellationToken>()).Returns(user);
        resetTokenRepository.GetActiveByUserIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(new List<PasswordResetToken> { previous });
        tokenGenerator.Generate().Returns("dfpr_fresh");
        linkBuilder.Build("dfpr_fresh").Returns("https://app.test/reset-password?token=dfpr_fresh");

        var handler = new ForgotPasswordCommandHandler(
            userRepository,
            resetTokenRepository,
            emailService,
            tokenGenerator,
            linkBuilder,
            unitOfWork,
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ForgotPasswordCommandHandler>>());

        await handler.Handle(new ForgotPasswordCommand(Email), CancellationToken.None);

        // Requesting twice must not leave two working keys — only the newest
        // link is live, so a late-arriving older email is useless.
        Assert.NotNull(previousRevokedAt ?? previous.RevokedAtUtc);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResetPassword_ShouldBurnTokenAndRevokeSessions_WhenSuccessful()
    {
        var user = CreateUser();
        var token = CreateLiveToken(user.Id);

        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var unitOfWork = Substitute.For<IUnitOfWork>();

        resetTokenRepository
            .GetByTokenHashAsync(PasswordResetTokenHasher.Hash("dfpr_live"), Arg.Any<CancellationToken>())
            .Returns(token);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        passwordHasher.Hash("N3wPassword!").Returns("new-hash");
        refreshTokenRepository.RevokeAllForUserAsync(user.Id, Arg.Any<CancellationToken>()).Returns(3);

        var handler = new ResetPasswordCommandHandler(
            resetTokenRepository,
            userRepository,
            refreshTokenRepository,
            passwordHasher,
            unitOfWork,
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ResetPasswordCommandHandler>>());

        await handler.Handle(new ResetPasswordCommand("dfpr_live", "N3wPassword!"), CancellationToken.None);

        Assert.NotNull(token.UsedAtUtc);
        await refreshTokenRepository.Received(1)
            .RevokeAllForUserAsync(user.Id, Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResetPassword_ShouldVerifyEmail_WhenAccountCameFromOAuth()
    {
        // OAuth users are stored with a placeholder hash and arrive here
        // unverified if the provider never confirmed the address. Completing a
        // reset is proof of the mailbox, so the account becomes usable by
        // password and stops being locked out of login.
        var user = User.Create(Email, "devuser", new string('#', 60), "Dev User");
        Assert.False(user.IsEmailVerified);

        var token = CreateLiveToken(user.Id);

        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var unitOfWork = Substitute.For<IUnitOfWork>();

        resetTokenRepository
            .GetByTokenHashAsync(PasswordResetTokenHasher.Hash("dfpr_live"), Arg.Any<CancellationToken>())
            .Returns(token);
        userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        passwordHasher.Hash("N3wPassword!").Returns("new-hash");

        var handler = new ResetPasswordCommandHandler(
            resetTokenRepository,
            userRepository,
            refreshTokenRepository,
            passwordHasher,
            unitOfWork,
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ResetPasswordCommandHandler>>());

        await handler.Handle(new ResetPasswordCommand("dfpr_live", "N3wPassword!"), CancellationToken.None);

        Assert.True(user.IsEmailVerified);
    }

    [Fact]
    public async Task ResetPassword_ShouldReject_WhenTokenWasAlreadyUsed()
    {
        var user = CreateUser();
        var token = CreateLiveToken(user.Id);
        token.MarkUsed(DateTimeOffset.UtcNow);

        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var userRepository = Substitute.For<IUserRepository>();

        resetTokenRepository
            .GetByTokenHashAsync(PasswordResetTokenHasher.Hash("dfpr_live"), Arg.Any<CancellationToken>())
            .Returns(token);

        var handler = new ResetPasswordCommandHandler(
            resetTokenRepository,
            userRepository,
            Substitute.For<IRefreshTokenRepository>(),
            passwordHasher,
            Substitute.For<IUnitOfWork>(),
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ResetPasswordCommandHandler>>());

        // A replay must fail exactly like a token that never existed, and must
        // not touch the password.
        await Assert.ThrowsAsync<ValidationException>(
            () => handler.Handle(new ResetPasswordCommand("dfpr_live", "N3wPassword!"), CancellationToken.None));

        passwordHasher.DidNotReceive().Hash(Arg.Any<string>());
    }

    [Fact]
    public async Task ResetPassword_ShouldReject_WhenTokenIsUnknown()
    {
        var resetTokenRepository = Substitute.For<IPasswordResetTokenRepository>();
        var passwordHasher = Substitute.For<IPasswordHasher>();

        resetTokenRepository
            .GetByTokenHashAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((PasswordResetToken?)null);

        var handler = new ResetPasswordCommandHandler(
            resetTokenRepository,
            Substitute.For<IUserRepository>(),
            Substitute.For<IRefreshTokenRepository>(),
            passwordHasher,
            Substitute.For<IUnitOfWork>(),
            Substitute.For<Microsoft.Extensions.Logging.ILogger<ResetPasswordCommandHandler>>());

        await Assert.ThrowsAsync<ValidationException>(
            () => handler.Handle(new ResetPasswordCommand("dfpr_guess", "N3wPassword!"), CancellationToken.None));

        passwordHasher.DidNotReceive().Hash(Arg.Any<string>());
    }
}
