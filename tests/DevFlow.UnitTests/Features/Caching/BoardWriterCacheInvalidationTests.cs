using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.UpdateProfile;
using DevFlow.Application.Features.Sprints;
using DevFlow.Application.Features.Sprints.Update;
using DevFlow.Application.Features.Templates;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression (post-EF9 sweep): apply-template creates a real board task
/// and sprint-rename changes fields velocity history reports on, yet
/// neither command was an IProjectEvent — the project cache tag survived
/// the write and collaborators stared at a stale board/velocity chart for
/// a full 30s TTL. Separately, a profile rename never dropped the
/// per-workspace member-roster cache (untagged workspace-members:{id},
/// 2-min TTL, only touched by invite/remove/role), so assignee pickers
/// kept showing the old username/displayName.
/// </summary>
public class BoardWriterCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task ApplyTemplateCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new ApplyTemplateCommand(Guid.NewGuid(), _projectId, Guid.NewGuid());

        var behavior = new CacheInvalidationBehavior<ApplyTemplateCommand, Guid>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(Guid.NewGuid()), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public async Task UpdateSprintCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new UpdateSprintCommand(Guid.NewGuid(), _projectId, Guid.NewGuid(), "Sprint X", null);

        var behavior = new CacheInvalidationBehavior<UpdateSprintCommand, SprintResponse>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(NewSprintResponse()), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public void BoardWriters_ShouldNotLogActivity()
    {
        Assert.Equal("", ((IProjectEvent)new ApplyTemplateCommand(Guid.NewGuid(), _projectId, Guid.NewGuid())).ActivityVerb);
        Assert.Equal("", ((IProjectEvent)new UpdateSprintCommand(Guid.NewGuid(), _projectId, Guid.NewGuid(), "S", null)).ActivityVerb);
    }

    private SprintResponse NewSprintResponse() =>
        new(Guid.NewGuid(), _projectId, "Sprint X", null, "Planned", null, null, null);
}

/// <summary>
/// UpdateProfile writes rows that member rosters embed (username,
/// display name) under an untagged per-workspace cache key, so the
/// handler must RemoveAsync every workspace the user belongs to — the
/// same bookkeeping InviteMember/RemoveMember/UpdateMemberRole already do.
/// </summary>
public class UpdateProfileMemberCacheInvalidationTests
{
    private readonly IUserRepository _users = Substitute.For<IUserRepository>();
    private readonly IWorkspaceRepository _workspaces = Substitute.For<IWorkspaceRepository>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    [Fact]
    public async Task UpdateProfile_ShouldRemoveWorkspaceMemberCacheForEveryMembership()
    {
        var user = User.Create("j@dev.io", "oldname", "hash", "Old Name");
        _users.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _users.ExistsByUsernameExceptIdAsync("newname", user.Id, Arg.Any<CancellationToken>()).Returns(false);
        var first = Workspace.Create("Alpha", "alpha", null);
        var second = Workspace.Create("Beta", "beta", null);
        _workspaces.GetForUserAsync(user.Id, Arg.Any<CancellationToken>()).Returns(
            new List<(Workspace, WorkspaceRole)> { (first, WorkspaceRole.Member), (second, WorkspaceRole.Admin) });

        var handler = new UpdateProfileCommandHandler(_users, _workspaces, _cache, _unitOfWork);
        await handler.Handle(new UpdateProfileCommand(user.Id, "New Name", "newname"), CancellationToken.None);

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _cache.Received(1).RemoveAsync($"workspace-members:{first.Id}", Arg.Any<CancellationToken>());
        await _cache.Received(1).RemoveAsync($"workspace-members:{second.Id}", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateProfile_ShouldStillPersist_WhenUserHasNoWorkspaces()
    {
        var user = User.Create("solo@dev.io", "solo", "hash", "Solo");
        _users.GetByIdAsync(user.Id, Arg.Any<CancellationToken>()).Returns(user);
        _users.ExistsByUsernameExceptIdAsync("solo2", user.Id, Arg.Any<CancellationToken>()).Returns(false);
        _workspaces.GetForUserAsync(user.Id, Arg.Any<CancellationToken>()).Returns([]);

        var handler = new UpdateProfileCommandHandler(_users, _workspaces, _cache, _unitOfWork);
        await handler.Handle(new UpdateProfileCommand(user.Id, "Solo Two", "solo2"), CancellationToken.None);

        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _cache.DidNotReceiveWithAnyArgs().RemoveAsync(default!, default);
    }
}
