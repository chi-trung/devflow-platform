using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.UpdateMemberRole;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class UpdateMemberRoleCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly UpdateMemberRoleCommandHandler _handler;
    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid _memberId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();

    private readonly User _ownerUser = User.Create("owner@test.io", "owner", "Sup3rSecret!", "Owner User");
    private readonly User _memberUser = User.Create("member@test.io", "member", "Sup3rSecret!", "Member User");

    public UpdateMemberRoleCommandHandlerTests()
    {
        _handler = new UpdateMemberRoleCommandHandler(
            _workspaceRepository, _userRepository, _userContext, _activityLogRepository, _cacheService, _unitOfWork);

        _workspaceRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Workspace.Create("Acme", "acme", null));
    }

    [Fact]
    public async Task Handle_ShouldUpdateRole_WhenOwnerChangesMemberToAdmin()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _userRepository.GetByIdAsync(_ownerId, Arg.Any<CancellationToken>()).Returns(_ownerUser);
        _userRepository.GetByIdAsync(_memberId, Arg.Any<CancellationToken>()).Returns(_memberUser);

        var command = new UpdateMemberRoleCommand(_workspaceId, _memberId, WorkspaceRole.Admin);

        await _handler.Handle(command, CancellationToken.None);

        await _workspaceRepository.Received(1).UpdateMemberRoleAsync(_workspaceId, _memberId, WorkspaceRole.Admin, Arg.Any<CancellationToken>());
        await _cacheService.Received(1).RemoveAsync($"workspace-members:{_workspaceId}", Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(Arg.Is<ActivityLog>(log =>
            log.Action == "changed role of" && log.Target == "Member User to Admin"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowForbidden_WhenAdminChangesRole()
    {
        var adminId = Guid.NewGuid();
        _userContext.UserId.Returns(adminId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, adminId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var command = new UpdateMemberRoleCommand(_workspaceId, _memberId, WorkspaceRole.Admin);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().UpdateMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenChangingOwnRole()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);

        var command = new UpdateMemberRoleCommand(_workspaceId, _ownerId, WorkspaceRole.Admin);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().UpdateMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenWorkspaceDoesNotExist()
    {
        _workspaceRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Workspace?)null);

        var command = new UpdateMemberRoleCommand(Guid.NewGuid(), _memberId, WorkspaceRole.Admin);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenTargetUserIsNotMember()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);

        var command = new UpdateMemberRoleCommand(_workspaceId, _memberId, WorkspaceRole.Admin);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().UpdateMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenRoleIsAlreadySet()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var command = new UpdateMemberRoleCommand(_workspaceId, _memberId, WorkspaceRole.Admin);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().UpdateMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldPromoteToOwner_WhenOwnerPromotesMember()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _userRepository.GetByIdAsync(_ownerId, Arg.Any<CancellationToken>()).Returns(_ownerUser);
        _userRepository.GetByIdAsync(_memberId, Arg.Any<CancellationToken>()).Returns(_memberUser);

        var command = new UpdateMemberRoleCommand(_workspaceId, _memberId, WorkspaceRole.Owner);

        await _handler.Handle(command, CancellationToken.None);

        await _workspaceRepository.Received(1).UpdateMemberRoleAsync(_workspaceId, _memberId, WorkspaceRole.Owner, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}