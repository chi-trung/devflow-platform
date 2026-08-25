using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.ProjectMembers;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.ProjectMembers;

public class ProjectMemberCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IProjectMemberRepository _projectMemberRepository = Substitute.For<IProjectMemberRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly User _user = User.Create("member@test.io", "member", "Sup3rSecret!", "Member");

    public ProjectMemberCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(_project);
        _userRepository.GetByIdAsync(_user.Id, Arg.Any<CancellationToken>())
            .Returns(_user);
    }

    // ── Add ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Add_ShouldAddMember_WhenUserIsWorkspaceMember()
    {
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _user.Id, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _projectMemberRepository.ExistsAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new AddProjectMemberCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Manager);

        var response = await new AddProjectMemberCommandHandler(
            _projectRepository, _projectMemberRepository, _workspaceRepository, _userRepository, _unitOfWork)
            .Handle(command, CancellationToken.None);

        Assert.Equal(_user.Id, response.UserId);
        Assert.Equal("Manager", response.Role);
        Assert.Equal(_user.Username, response.Username);
        Assert.Equal(_user.DisplayName, response.DisplayName);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Add_ShouldThrowNotFound_WhenProjectBelongsToDifferentWorkspace()
    {
        var foreignWorkspaceId = Guid.NewGuid();
        var foreignProject = Project.Create(foreignWorkspaceId, "Foreign", "FOR", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(foreignProject);

        var command = new AddProjectMemberCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Member);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new AddProjectMemberCommandHandler(
                _projectRepository, _projectMemberRepository, _workspaceRepository, _userRepository, _unitOfWork)
                .Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Add_ShouldThrowNotFound_WhenUserIsNotWorkspaceMember()
    {
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _user.Id, Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);

        var command = new AddProjectMemberCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Member);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new AddProjectMemberCommandHandler(
                _projectRepository, _projectMemberRepository, _workspaceRepository, _userRepository, _unitOfWork)
                .Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Add_ShouldThrowConflict_WhenAlreadyProjectMember()
    {
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _user.Id, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);
        _projectMemberRepository.ExistsAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new AddProjectMemberCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Member);

        await Assert.ThrowsAsync<ConflictException>(() =>
            new AddProjectMemberCommandHandler(
                _projectRepository, _projectMemberRepository, _workspaceRepository, _userRepository, _unitOfWork)
                .Handle(command, CancellationToken.None));
    }

    // ── Update role ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateRole_ShouldUpdateRole_WhenMemberExists()
    {
        var member = ProjectMember.Create(_project.Id, _user.Id, ProjectRole.Member);
        _projectMemberRepository.GetAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns(member);

        var command = new UpdateProjectMemberRoleCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Manager);

        await new UpdateProjectMemberRoleCommandHandler(
            _projectRepository, _projectMemberRepository, _unitOfWork)
            .Handle(command, CancellationToken.None);

        Assert.Equal(ProjectRole.Manager, member.Role);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateRole_ShouldThrowNotFound_WhenMemberDoesNotExist()
    {
        _projectMemberRepository.GetAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns((ProjectMember?)null);

        var command = new UpdateProjectMemberRoleCommand(_workspaceId, _project.Id, _user.Id, ProjectRole.Manager);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new UpdateProjectMemberRoleCommandHandler(
                _projectRepository, _projectMemberRepository, _unitOfWork)
                .Handle(command, CancellationToken.None));
    }

    // ── Remove ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Remove_ShouldRemoveMember_WhenExists()
    {
        _projectMemberRepository.ExistsAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new RemoveProjectMemberCommand(_workspaceId, _project.Id, _user.Id);

        await new RemoveProjectMemberCommandHandler(
            _projectRepository, _projectMemberRepository, _unitOfWork)
            .Handle(command, CancellationToken.None);

        await _projectMemberRepository.Received(1).RemoveAsync(
            _project.Id, _user.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Remove_ShouldThrowNotFound_WhenNotProjectMember()
    {
        _projectMemberRepository.ExistsAsync(_project.Id, _user.Id, Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new RemoveProjectMemberCommand(_workspaceId, _project.Id, _user.Id);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            new RemoveProjectMemberCommandHandler(
                _projectRepository, _projectMemberRepository, _unitOfWork)
                .Handle(command, CancellationToken.None));
    }

    // ── List ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_ShouldReturnMembers_WithResolvedNames()
    {
        var memberA = ProjectMember.Create(_project.Id, _user.Id, ProjectRole.Manager);
        var memberB = ProjectMember.Create(_project.Id, Guid.NewGuid(), ProjectRole.Member);

        _projectMemberRepository.GetByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<ProjectMember> { memberA, memberB });
        _userRepository.GetByIdsAsync(
                Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, User>
            {
                [_user.Id] = _user
            });

        var query = new ListProjectMembersQuery(_workspaceId, _project.Id);

        var result = await new ListProjectMembersQueryHandler(
            _projectRepository, _projectMemberRepository, _userRepository)
            .Handle(query, CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal(_user.Username, result[0].Username);
        Assert.Equal("unknown", result[1].Username); // orphan member without a user row
        Assert.Equal("Unknown", result[1].DisplayName);
    }

    [Fact]
    public async Task List_ShouldReturnEmpty_WhenNoMembers()
    {
        _projectMemberRepository.GetByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<ProjectMember>());

        var query = new ListProjectMembersQuery(_workspaceId, _project.Id);

        var result = await new ListProjectMembersQueryHandler(
            _projectRepository, _projectMemberRepository, _userRepository)
            .Handle(query, CancellationToken.None);

        Assert.Empty(result);
    }
}
