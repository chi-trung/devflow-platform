using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.ListMembers;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class ListWorkspaceMembersQueryHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();

    private readonly ListWorkspaceMembersQueryHandler _handler;

    public ListWorkspaceMembersQueryHandlerTests()
    {
        _handler = new ListWorkspaceMembersQueryHandler(_workspaceRepository);
    }

    [Fact]
    public async Task Handle_ShouldReturnMembersMappedToResponse()
    {
        var userId = Guid.NewGuid();
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([(userId, "member@test.io", "member", "Member", WorkspaceRole.Admin)]);

        var response = await _handler.Handle(
            new ListWorkspaceMembersQuery(Guid.NewGuid()), CancellationToken.None);

        var member = Assert.Single(response);
        Assert.Equal(userId, member.UserId);
        Assert.Equal("member@test.io", member.Email);
        Assert.Equal("member", member.Username);
        Assert.Equal("Member", member.DisplayName);
        Assert.Equal("Admin", member.Role);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyList_WhenWorkspaceHasNoMembers()
    {
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var response = await _handler.Handle(
            new ListWorkspaceMembersQuery(Guid.NewGuid()), CancellationToken.None);

        Assert.Empty(response);
    }
}
