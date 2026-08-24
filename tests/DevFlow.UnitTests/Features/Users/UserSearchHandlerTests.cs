using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Users;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Users;

public class UserSearchHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();

    private readonly (Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)[] _members =
    {
        (Guid.NewGuid(), "alice@devflow.local", "alice", "Alice Doe", WorkspaceRole.Member),
        (Guid.NewGuid(), "bob@devflow.local", "bob", "Bob Smith", WorkspaceRole.Admin),
        (Guid.NewGuid(), "carol@devflow.local", "carol", "Carol Nguyen", WorkspaceRole.Member),
    };

    public UserSearchHandlerTests()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(_members);
    }

    [Fact]
    public async Task Search_ShouldMatchByUsername()
    {
        var handler = new SearchUsersHandler(_workspaceRepository);
        var result = await handler.Handle(new SearchUsersQuery(_workspaceId, "ali"), CancellationToken.None);

        var user = Assert.Single(result);
        Assert.Equal("alice", user.Username);
    }

    [Fact]
    public async Task Search_ShouldMatchByDisplayName()
    {
        var handler = new SearchUsersHandler(_workspaceRepository);
        var result = await handler.Handle(new SearchUsersQuery(_workspaceId, "nguyen"), CancellationToken.None);

        var user = Assert.Single(result);
        Assert.Equal("carol", user.Username);
    }

    [Fact]
    public async Task Search_ShouldReturnEmpty_WhenQueryTooShort()
    {
        var handler = new SearchUsersHandler(_workspaceRepository);
        var result = await handler.Handle(new SearchUsersQuery(_workspaceId, "a"), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Search_ShouldReturnEmpty_WhenNoMatches()
    {
        var handler = new SearchUsersHandler(_workspaceRepository);
        var result = await handler.Handle(new SearchUsersQuery(_workspaceId, "zzz-nonexistent"), CancellationToken.None);

        Assert.Empty(result);
    }
}
