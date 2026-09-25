using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Register;
using DevFlow.Application.Features.Email;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class RegisterCommandHandlerTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IEmailVerificationLinkBuilder _linkBuilder = Substitute.For<IEmailVerificationLinkBuilder>();
    private readonly ILogger<RegisterCommandHandler> _logger =
        Substitute.For<ILogger<RegisterCommandHandler>>();

    private readonly RegisterCommandHandler _handler;

    public RegisterCommandHandlerTests()
    {
        _linkBuilder.Build(Arg.Any<Guid>()).Returns("https://app.devflow.io/verify-email?token=abc");
        _emailService.SendEmailVerificationAsync(
                Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(Task.CompletedTask);

        _handler = new RegisterCommandHandler(
            _userRepository,
            _unitOfWork,
            _passwordHasher,
            _emailService,
            _linkBuilder,
            _logger);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenEmailAlreadyExists()
    {
        _userRepository.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new RegisterCommand("dev@test.io", "devuser", "Sup3rSecret!", "Dev User");

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenUsernameAlreadyTaken()
    {
        _userRepository.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new RegisterCommand("dev@test.io", "devuser", "Sup3rSecret!", "Dev User");

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldHashPasswordAndPersistUser_WhenInputIsValid()
    {
        _userRepository.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _passwordHasher.Hash(Arg.Any<string>()).Returns("hashed-password");

        var command = new RegisterCommand("dev@test.io", "devuser", "Sup3rSecret!", "Dev User");

        var userId = await _handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, userId);
        await _userRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.User>(user => user.Email == "dev@test.io"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A new account starts unverified. Nothing in the register path may mark
    /// it verified, or the whole gate is a no-op.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldCreateUserUnverified_AndSendVerificationLink()
    {
        _userRepository.ExistsByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        _passwordHasher.Hash(Arg.Any<string>()).Returns("hashed-password");

        var command = new RegisterCommand("dev@test.io", "devuser", "Sup3rSecret!", "Dev User");

        await _handler.Handle(command, CancellationToken.None);

        await _userRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.User>(user => !user.IsEmailVerified),
            Arg.Any<CancellationToken>());

        await _emailService.Received(1).SendEmailVerificationAsync(
            "dev@test.io",
            "Dev User",
            "https://app.devflow.io/verify-email?token=abc");
    }
}
