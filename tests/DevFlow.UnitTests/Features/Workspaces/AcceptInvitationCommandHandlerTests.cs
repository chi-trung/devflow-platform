using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.AcceptInvitation;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class AcceptInvitationCommandHandlerTests
{
    private readonly IWorkspaceInvitationRepository _invitationRepository = Substitute.For<IWorkspaceInvitationRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly AcceptInvitationCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();

    public AcceptInvitationCommandHandlerTests()
    {
        _handler = new AcceptInvitationCommandHandler(
            _invitationRepository, _workspaceRepository, _userContext, _cacheService, _unitOfWork);
        _userContext.UserId.Returns(_userId);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenInvitationMissing()
    {
        _invitationRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceInvitation?)null);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(new AcceptInvitationCommand(Guid.NewGuid()), CancellationToken.None));
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenInvitationBelongsToAnotherUser()
    {
        var invitation = WorkspaceInvitation.Create(_workspaceId, Guid.NewGuid(), "other@test.io", WorkspaceRole.Member, Guid.NewGuid());
        _invitationRepository.GetByIdAsync(invitation.Id, Arg.Any<CancellationToken>())
            .Returns(invitation);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(new AcceptInvitationCommand(invitation.Id), CancellationToken.None));
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenAlreadyDeclined()
    {
        var invitation = WorkspaceInvitation.Create(_workspaceId, _userId, "me@test.io", WorkspaceRole.Member, Guid.NewGuid());
        invitation.Decline();
        _invitationRepository.GetByIdAsync(invitation.Id, Arg.Any<CancellationToken>())
            .Returns(invitation);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _handler.Handle(new AcceptInvitationCommand(invitation.Id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldAddMembership_WhenPendingInvitationAccepted()
    {
        var invitation = WorkspaceInvitation.Create(_workspaceId, _userId, "me@test.io", WorkspaceRole.Admin, Guid.NewGuid());
        var workspace = Workspace.Create("Acme", "acme", null);

        _invitationRepository.GetByIdAsync(invitation.Id, Arg.Any<CancellationToken>())
            .Returns(invitation);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _userId, Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);
        _workspaceRepository.GetByIdAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(workspace);

        var result = await _handler.Handle(new AcceptInvitationCommand(invitation.Id), CancellationToken.None);

        Assert.Equal(_workspaceId, result.WorkspaceId);
        Assert.Equal("Acme", result.WorkspaceName);
        Assert.Equal("Admin", result.Role);
        Assert.Equal(InvitationStatus.Accepted, invitation.Status);

        await _workspaceRepository.Received(1).AddMemberAsync(
            workspace, _userId, WorkspaceRole.Admin, Arg.Any<CancellationToken>());
        await _cacheService.Received(1).RemoveAsync($"workspace-members:{_workspaceId}", Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldNotDoubleAdd_WhenAlreadyMember()
    {
        var invitation = WorkspaceInvitation.Create(_workspaceId, _userId, "me@test.io", WorkspaceRole.Member, Guid.NewGuid());
        var workspace = Workspace.Create("Acme", "acme", null);

        _invitationRepository.GetByIdAsync(invitation.Id, Arg.Any<CancellationToken>())
            .Returns(invitation);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _userId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _workspaceRepository.GetByIdAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(workspace);

        var result = await _handler.Handle(new AcceptInvitationCommand(invitation.Id), CancellationToken.None);

        Assert.Equal("Member", result.Role);
        Assert.Equal(InvitationStatus.Accepted, invitation.Status);
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
