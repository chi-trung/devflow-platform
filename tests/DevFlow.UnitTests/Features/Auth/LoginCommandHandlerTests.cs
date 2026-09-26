using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class LoginCommandHandlerTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IRefreshTokenRepository _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IPasswordHasher _passwordHasher = Substitute.For<IPasswordHasher>();
    private readonly ITokenProvider _tokenProvider = Substitute.For<ITokenProvider>();

    private readonly LoginCommandHandler _handler;

    public LoginCommandHandlerTests()
    {
        _handler = new LoginCommandHandler(
            _userRepository,
            _refreshTokenRepository,
            _unitOfWork,
            _passwordHasher,
            _tokenProvider);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorized_WhenUsernameIsUnknown()
    {
        _userRepository.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);

        var command = new LoginCommand("ghost", "Sup3rSecret!");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorized_WhenPasswordDoesNotMatch()
    {
        var user = Domain.Entities.User.Create("dev@test.io", "devuser", "stored-hash", "Dev User");
        _userRepository.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(false);

        var command = new LoginCommand("devuser", "Wr0ngPassword!");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(command, CancellationToken.None));
    }

    /// <summary>
    /// An unknown handle and a wrong password must be indistinguishable to the
    /// caller. If one of them produced a different message, status, or error
    /// code, the login form would answer "does this account exist?" for any
    /// name the caller cares to try.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldGiveTheSameMessage_ForUnknownUserAndWrongPassword()
    {
        var unknownMessage = await CaptureMessageAsync(user: null);
        var wrongPasswordMessage = await CaptureMessageAsync(
            Domain.Entities.User.Create("dev@test.io", "devuser", "stored-hash", "Dev User"));

        Assert.Equal(unknownMessage, wrongPasswordMessage);
    }

    private static async Task<string> CaptureMessageAsync(Domain.Entities.User? user)
    {
        var userRepository = Substitute.For<IUserRepository>();
        var refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var passwordHasher = Substitute.For<IPasswordHasher>();
        var tokenProvider = Substitute.For<ITokenProvider>();

        userRepository.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(false);

        var handler = new LoginCommandHandler(
            userRepository, refreshTokenRepository, unitOfWork, passwordHasher, tokenProvider);

        var error = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => handler.Handle(new LoginCommand("devuser", "Wr0ngPassword!"), CancellationToken.None));

        return error.Message;
    }

    [Fact]
    public async Task Handle_ShouldIssueTokens_WhenCredentialsAreValid()
    {
        var user = Domain.Entities.User.Create("dev@test.io", "devuser", "stored-hash", "Dev User");
        _userRepository.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>()).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new LoginCommand("devuser", "Sup3rSecret!");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        Assert.Equal("refresh-token", response.RefreshToken);
        await _refreshTokenRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.RefreshToken>(token => token.Token == "refresh-token"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A password account has no address, so there is nothing to verify. If
    /// this ever starts throwing, every account created through the current
    /// form is locked out of its own app.
    /// </summary>
    [Fact]
    public async Task Handle_ShouldIssueTokens_WhenAccountHasNoEmail()
    {
        var user = Domain.Entities.User.CreateWithPassword("devuser", "stored-hash", "Dev User");
        _userRepository.GetByUsernameAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>()).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var response = await _handler.Handle(
            new LoginCommand("devuser", "Sup3rSecret!"), CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        Assert.Equal("refresh-token", response.RefreshToken);
    }
}
