using DevFlow.Application.Common.Exceptions;
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
    public async Task Handle_ShouldThrowUnauthorized_WhenEmailIsUnknown()
    {
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);

        var command = new LoginCommand("ghost@test.io", "Sup3rSecret!");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorized_WhenPasswordDoesNotMatch()
    {
        var user = Domain.Entities.User.Create("dev@test.io", "devuser", "stored-hash", "Dev User");
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(false);

        var command = new LoginCommand("dev@test.io", "Wr0ngPassword!");

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldIssueTokens_WhenCredentialsAreValid()
    {
        var user = Domain.Entities.User.Create("dev@test.io", "devuser", "stored-hash", "Dev User");
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(user);
        _passwordHasher.Verify(Arg.Any<string>(), Arg.Any<string>()).Returns(true);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>()).Returns("access-token");
        _tokenProvider.GenerateRefreshToken().Returns("refresh-token");

        var command = new LoginCommand("dev@test.io", "Sup3rSecret!");

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("access-token", response.AccessToken);
        Assert.Equal("refresh-token", response.RefreshToken);
        await _refreshTokenRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.RefreshToken>(token => token.Token == "refresh-token"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
