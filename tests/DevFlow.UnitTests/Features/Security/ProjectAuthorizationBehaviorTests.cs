using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.ProjectMembers;
using DevFlow.Domain.Enums;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Security;

public class ProjectAuthorizationBehaviorTests
{
    private readonly IProjectMemberRepository _projectMemberRepository = Substitute.For<IProjectMemberRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public ProjectAuthorizationBehaviorTests()
    {
        _userContext.UserId.Returns(_userId);
    }

    private ProjectAuthorizationBehavior<TRequest, string> CreateBehavior<TRequest>()
        where TRequest : notnull
        => new(_projectMemberRepository, _userContext);

    [Fact]
    public async Task ProjectManager_ShouldPass_ManagerLevelCommand()
    {
        _projectMemberRepository.GetRoleAsync(_projectId, _userId, Arg.Any<CancellationToken>())
            .Returns(ProjectRole.Manager);

        var behavior = CreateBehavior<AddProjectMemberCommand>();
        var request = new AddProjectMemberCommand(_workspaceId, _projectId, Guid.NewGuid(), ProjectRole.Member);

        var result = await behavior.Handle(request, () => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }

    [Fact]
    public async Task ProjectMember_ShouldBeDenied_ManagerLevelCommand()
    {
        _projectMemberRepository.GetRoleAsync(_projectId, _userId, Arg.Any<CancellationToken>())
            .Returns(ProjectRole.Member);

        var behavior = CreateBehavior<AddProjectMemberCommand>();
        var request = new AddProjectMemberCommand(_workspaceId, _projectId, Guid.NewGuid(), ProjectRole.Member);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, () => Task.FromResult("handled"), CancellationToken.None));
    }

    [Fact]
    public async Task NonProjectMember_ShouldFallThrough_ToWorkspaceCheck()
    {
        // Not a project member → project-role gate is bypassed; the workspace
        // authorization behavior (separate pipeline step) handles the rest.
        _projectMemberRepository.GetRoleAsync(_projectId, _userId, Arg.Any<CancellationToken>())
            .Returns((ProjectRole?)null);

        var behavior = CreateBehavior<AddProjectMemberCommand>();
        var request = new AddProjectMemberCommand(_workspaceId, _projectId, Guid.NewGuid(), ProjectRole.Member);

        var result = await behavior.Handle(request, () => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }

    [Fact]
    public async Task WorkspaceAdminWhoIsProjectMember_WithMemberRole_ShouldBeDenied()
    {
        // Even a workspace Admin is restricted to project-level role once they
        // are an explicit project member with a lower project role.
        _projectMemberRepository.GetRoleAsync(_projectId, _userId, Arg.Any<CancellationToken>())
            .Returns(ProjectRole.Member);

        var behavior = CreateBehavior<AddProjectMemberCommand>();
        var request = new AddProjectMemberCommand(_workspaceId, _projectId, Guid.NewGuid(), ProjectRole.Member);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, () => Task.FromResult("handled"), CancellationToken.None));
    }

    [Fact]
    public async Task RequestWithoutProjectRoleAttribute_ShouldPass()
    {
        // ListProjectMembersQuery carries no [RequireProjectRole] → always passes.
        var behavior = CreateBehavior<ListProjectMembersQuery>();
        var request = new ListProjectMembersQuery(_workspaceId, _projectId);

        var result = await behavior.Handle(request, () => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }
}
