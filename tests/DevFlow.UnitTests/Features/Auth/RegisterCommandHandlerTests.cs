using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Register;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class RegisterCommandHandlerTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();

    private readonly RegisterCommandHandler _handler;

    public RegisterCommandHandlerTests()
    {
        _handler = new RegisterCommandHandler(
            _userRepository,
            _unitOfWork,
            _passwordHasher);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenUsernameAlreadyTaken()
    {
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new RegisterCommand("devuser", "Sup3rSecret!", "Dev User");

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldHashPasswordAndPersistUser_WhenInputIsValid()
    {
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _passwordHasher.Hash("Sup3rSecret!").Returns("hashed-password");

        var command = new RegisterCommand("devuser", "Sup3rSecret!", "Dev User");

        var userId = await _handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, userId);
        await _userRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.User>(user =>
                user.Username == "devuser" &&
                user.PasswordHash == "hashed-password" &&
                user.DisplayName == "Dev User"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// The reason the form lost its email field. A registration that attaches
    /// an address is a registration that can claim somebody else's inbox —
    /// there is no way to prove the address belongs to whoever typed it
    /// without mailing it, and the whole point was to stop mailing.
    ///
    /// The consequence is that a fresh account has no recovery route, which is
    /// why the dashboard prompts it to link a Google or GitHub identity
    /// instead. Pinned here so reintroducing the field is a failing test
    /// rather than a silent re-opened hole.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldCreateUserWithNoEmail()
    {
        _userRepository.ExistsByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);
        _passwordHasher.Hash(Arg.Any<string>()).Returns("hashed-password");

        var command = new RegisterCommand("devuser", "Sup3rSecret!", "Dev User");

        await _handler.Handle(command, CancellationToken.None);

        await _userRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.User>(user =>
                user.Email == null && !user.IsEmailVerified && !user.CanBeRecovered),
            Arg.Any<CancellationToken>());
    }
}
