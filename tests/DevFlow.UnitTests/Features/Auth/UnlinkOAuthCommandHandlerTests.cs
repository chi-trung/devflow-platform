using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.OAuth;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Auth;

public class UnlinkOAuthCommandHandlerTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ISocialLoginRepository _socialLoginRepository = Substitute.For<ISocialLoginRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly UnlinkOAuthCommandHandler _handler;

    public UnlinkOAuthCommandHandlerTests()
    {
        _handler = new UnlinkOAuthCommandHandler(
            _userRepository,
            _socialLoginRepository,
            _unitOfWork);
    }

    /// <summary>An account with a linked provider and an address — the ordinary
    ///  case where removing a provider is a plain, reversible preference.</summary>
    private static Domain.Entities.User RecoverableAccount()
        => Domain.Entities.User.CreateFromOAuth("a@gmail.com", "devuser", "hash", "Dev User");

    private void HasLink(Domain.Entities.User user, bool exists = true)
    {
        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _socialLoginRepository.ExistsForUserAsync(user.Id, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(exists);
    }

    [Fact]
    public async Task Handle_ShouldRemove_WhenAnotherWayInRemains()
    {
        // Two providers, so dropping one still leaves a way back in.
        var user = RecoverableAccount();
        HasLink(user);
        _userRepository.GetLinkedProvidersAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { "github" });

        var response = await _handler.Handle(
            new UnlinkOAuthCommand(user.Id, "google"),
            CancellationToken.None);

        Assert.Equal(new[] { "github" }, response.Providers);
        await _socialLoginRepository.Received(1)
            .RemoveByProviderAsync(user.Id, "google", Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldNotRemove_WhenItWouldLeaveNoWayBackIn()
    {
        // The account's only route back is this provider, and it has no address
        // to send a reset to. Removing it would leave a password as the sole key
        // to the account — the exact state the dashboard warns about, reached by
        // accident rather than chosen.
        var user = Domain.Entities.User.CreateWithPassword("devuser", "hash", "Dev User");
        HasLink(user);

        var error = await Assert.ThrowsAsync<ConflictException>(() =>
            _handler.Handle(new UnlinkOAuthCommand(user.Id, "google"), CancellationToken.None));

        Assert.Contains("only way back", error.Message);
        await _socialLoginRepository.DidNotReceive()
            .RemoveByProviderAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenNothingIsLinked()
    {
        // Silently succeeding would let a UI render "removed" over a link that
        // is still there — the person would believe they had cut off an access
        // route they still have.
        var user = RecoverableAccount();
        HasLink(user, exists: false);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(new UnlinkOAuthCommand(user.Id, "google"), CancellationToken.None));

        await _socialLoginRepository.DidNotReceive()
            .RemoveByProviderAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldRejectAnUnknownProvider()
    {
        var user = RecoverableAccount();
        HasLink(user, exists: false);

        var error = await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(new UnlinkOAuthCommand(user.Id, "not-a-provider"), CancellationToken.None));

        Assert.Contains("provider", error.Errors.Keys);
        await _socialLoginRepository.DidNotReceive()
            .RemoveByProviderAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldNormaliseTheProviderName()
    {
        // The route parameter is whatever the URL says. "Google" and "google"
        // are the same provider, and a mismatch would make the existence check
        // miss and report NotFound for a link that is right there.
        var user = RecoverableAccount();
        HasLink(user);
        _userRepository.GetLinkedProvidersAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<string>());

        await _handler.Handle(new UnlinkOAuthCommand(user.Id, "  GooGle "), CancellationToken.None);

        await _socialLoginRepository.Received(1)
            .RemoveByProviderAsync(user.Id, "google", Arg.Any<CancellationToken>());
    }
}
