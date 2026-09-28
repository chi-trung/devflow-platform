using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.DeleteAccount;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Auth;

public class DeleteAccountCommandHandlerTests
{
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly DeleteAccountCommandHandler _handler;

    public DeleteAccountCommandHandlerTests()
    {
        _handler = new DeleteAccountCommandHandler(
            _userRepository,
            _cacheService,
            _unitOfWork);
    }

    private static Domain.Entities.User Account()
        => Domain.Entities.User.CreateWithPassword("probe_xyz", "hash", "Probe User");

    private void AccountExists(Domain.Entities.User user, params Guid[] touchedWorkspaces)
    {
        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _userRepository.RemoveAccountReferencesAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(touchedWorkspaces.ToList());
    }

    [Fact]
    public async Task Handle_ShouldStripReferencesThenRemoveTheAccount_WhenItExists()
    {
        // Both stages must run, and the account row must be the last thing
        // staged: memberships left behind would keep granting a workspace to
        // somebody who is no longer there.
        var user = Account();
        AccountExists(user);

        await _handler.Handle(new DeleteAccountCommand(user.Id), CancellationToken.None);

        Received.InOrder(() =>
        {
            _userRepository.RemoveAccountReferencesAsync(user.Id, Arg.Any<CancellationToken>());
            _userRepository.RemoveAsync(user, Arg.Any<CancellationToken>());
            _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task Handle_ShouldFlushExactlyOnce_AfterBothStages()
    {
        // One flush for everything. A save per stage would split the deletion
        // across two transactions, and a failure between them would leave the
        // account gone with its memberships — or the reverse — still present.
        var user = Account();
        AccountExists(user);

        await _handler.Handle(new DeleteAccountCommand(user.Id), CancellationToken.None);

        await _userRepository.Received(1)
            .RemoveAccountReferencesAsync(user.Id, Arg.Any<CancellationToken>());
        await _userRepository.Received(1).RemoveAsync(user, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldTargetTheIdInTheCommand_WhenDeleting()
    {
        // The only id the command can carry is the one in the access token, and
        // the repository must receive exactly that — an id smuggled in from a
        // request body would delete somebody else's account. There is no body
        // precisely so that cannot happen; this pins the value down anyway.
        var callerId = Guid.NewGuid();
        var user = Account();
        _userRepository.GetByIdAsync(callerId, Arg.Any<CancellationToken>()).Returns(user);
        _userRepository.RemoveAccountReferencesAsync(callerId, Arg.Any<CancellationToken>())
            .Returns(new List<Guid>());

        await _handler.Handle(new DeleteAccountCommand(callerId), CancellationToken.None);

        await _userRepository.Received(1)
            .RemoveAccountReferencesAsync(callerId, Arg.Any<CancellationToken>());
        await _userRepository.Received(0)
            .RemoveAccountReferencesAsync(
                Arg.Is<Guid>(id => id != callerId),
                Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldDropTheRosterCacheOfEveryTouchedWorkspace()
    {
        // The member list is cached for two minutes under an untagged key this
        // command's behaviors never touch, so nothing else will evict it. Left
        // alone the deleted person keeps showing up in assignee pickers and
        // rosters until the TTL expires on its own.
        var user = Account();
        var workspaces = new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() };
        AccountExists(user, workspaces);

        await _handler.Handle(new DeleteAccountCommand(user.Id), CancellationToken.None);

        foreach (var workspaceId in workspaces)
        {
            await _cacheService.Received(1)
                .RemoveAsync($"workspace-members:{workspaceId}", Arg.Any<CancellationToken>());
        }

        await _cacheService.Received(workspaces.Length)
            .RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldNotDropAnyCache_WhenTheFlushFails()
    {
        // Dropping the roster first would repopulate it from a database that
        // still lists the person. Ordering is what makes the cache agree with
        // the row rather than race it.
        var user = Account();
        AccountExists(user, Guid.NewGuid());
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("connection lost"));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _handler.Handle(new DeleteAccountCommand(user.Id), CancellationToken.None));

        await _cacheService.DidNotReceive()
            .RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldDoNothing_WhenTheAccountIsAlreadyGone()
    {
        // The access token is a JWT that outlives the row it names for up to a
        // quarter of an hour, so a retry arrives authenticated with nothing left
        // to delete. Staging against a null entity would throw instead of
        // quietly confirming the deletion that already happened.
        _userRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Domain.Entities.User?)null);

        await _handler.Handle(new DeleteAccountCommand(Guid.NewGuid()), CancellationToken.None);

        await _userRepository.DidNotReceive()
            .RemoveAccountReferencesAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _userRepository.DidNotReceive()
            .RemoveAsync(Arg.Any<Domain.Entities.User>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await _cacheService.DidNotReceive()
            .RemoveAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
