using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Pat;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Pat;

public class PatHandlerTests
{
    private readonly IPersonalAccessTokenRepository _patRepository = Substitute.For<IPersonalAccessTokenRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task Create_ShouldGenerateTokenAndHash()
    {
        var handler = new CreatePatCommandHandler(_patRepository, _unitOfWork);
        var command = new CreatePatCommand(
            _userId, "CLI", new[] { "read", "write" }, DateTimeOffset.UtcNow.AddDays(30));

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.Id);
        Assert.StartsWith("df_", response.Token);
        await _patRepository.Received(1).AddAsync(
            Arg.Is<PersonalAccessToken>(token =>
                token.UserId == _userId &&
                token.Scopes.Length == 2 &&
                token.TokenHash != response.Token),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldHashDifferentThanPlaintext()
    {
        var handler = new CreatePatCommandHandler(_patRepository, _unitOfWork);
        var command = new CreatePatCommand(_userId, "Bot", new[] { "tasks" }, null);

        var response = await handler.Handle(command, CancellationToken.None);

        await _patRepository.Received(1).AddAsync(
            Arg.Is<PersonalAccessToken>(token =>
                token.TokenHash.Length == 64 && token.TokenHash != response.Token),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task List_ShouldReturnActiveTokensWithoutHash()
    {
        var token = PersonalAccessToken.Create(
            _userId, "Deploy", "hash123", new[] { "write" }, DateTimeOffset.UtcNow.AddDays(10));
        _patRepository.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { token });

        var handler = new ListPatsQueryHandler(_patRepository);
        var result = await handler.Handle(new ListPatsQuery(_userId), CancellationToken.None);

        var response = Assert.Single(result);
        Assert.Equal(token.Id, response.Id);
        Assert.Equal("Deploy", response.Name);
        Assert.Single(response.Scopes);
    }

    [Fact]
    public async Task Revoke_ShouldRevokeWhenTokenOwnedByUser()
    {
        var token = PersonalAccessToken.Create(
            _userId, "Temp", "hash456", new[] { "read" }, DateTimeOffset.UtcNow.AddDays(5));
        _patRepository.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { token });

        var handler = new RevokePatCommandHandler(_patRepository, _unitOfWork);
        await handler.Handle(new RevokePatCommand(_userId, token.Id), CancellationToken.None);

        await _patRepository.Received(1).RevokeAsync(token.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Revoke_ShouldNotRevokeWhenTokenBelongsToOtherUser()
    {
        var otherUserToken = PersonalAccessToken.Create(
            Guid.NewGuid(), "Other", "hash789", new[] { "read" }, DateTimeOffset.UtcNow.AddDays(5));
        _patRepository.GetActiveByUserIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PersonalAccessToken>());

        var handler = new RevokePatCommandHandler(_patRepository, _unitOfWork);
        await handler.Handle(new RevokePatCommand(_userId, otherUserToken.Id), CancellationToken.None);

        await _patRepository.DidNotReceive().RevokeAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
