using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Application.Features.Auth.Refresh;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class RefreshCommandHandlerTests
{
    private readonly IRefreshTokenRepository _refreshTokenRepository = Substitute.For<IRefreshTokenRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ITokenProvider _tokenProvider = Substitute.For<ITokenProvider>();

    private readonly RefreshCommandHandler _handler;

    public RefreshCommandHandlerTests()
    {
        _handler = new RefreshCommandHandler(
            _refreshTokenRepository,
            _userRepository,
            _unitOfWork,
            _tokenProvider);
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorized_WhenTokenIsUnknown()
    {
        _refreshTokenRepository.GetByTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.RefreshToken?)null);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(new RefreshCommand("unknown-token"), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorized_WhenTokenWasRevoked()
    {
        var storedToken = Domain.Entities.RefreshToken.Create(
            Guid.NewGuid(), "revoked-token", DateTimeOffset.UtcNow.AddDays(1));
        storedToken.Revoke(DateTimeOffset.UtcNow);

        _refreshTokenRepository.GetByTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(storedToken);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _handler.Handle(new RefreshCommand("revoked-token"), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldRevokeOldTokenAndIssueNewPair_WhenTokenIsActive()
    {
        var userId = Guid.NewGuid();
        var user = Domain.Entities.User.Create("dev@test.io", "devuser", "hash", "Dev User");
        var storedToken = Domain.Entities.RefreshToken.Create(
            userId, "active-token", DateTimeOffset.UtcNow.AddDays(1));

        _refreshTokenRepository.GetByTokenAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(storedToken);
        _userRepository.GetByIdAsync(userId, Arg.Any<CancellationToken>()).Returns(user);
        _tokenProvider.GenerateAccessToken(Arg.Any<Domain.Entities.User>()).Returns("new-access");
        _tokenProvider.GenerateRefreshToken().Returns("new-refresh");

        var response = await _handler.Handle(new RefreshCommand("active-token"), CancellationToken.None);

        Assert.Equal("new-access", response.AccessToken);
        Assert.Equal("new-refresh", response.RefreshToken);
        Assert.True(storedToken.RevokedAtUtc is not null);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
