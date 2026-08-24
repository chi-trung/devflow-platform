using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Workspaces.RemoveMembers;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class RemoveMemberCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly RemoveMemberCommandHandler _handler;
    private readonly Guid _ownerId = Guid.NewGuid();
    private readonly Guid _adminId = Guid.NewGuid();
    private readonly Guid _memberId = Guid.NewGuid();
    private readonly Guid _workspaceId = Guid.NewGuid();

    private readonly User _ownerUser = User.Create("owner@test.io", "owner", "Sup3rSecret!", "Owner User");
    private readonly User _adminUser = User.Create("admin@test.io", "admin", "Sup3rSecret!", "Admin User");
    private readonly User _memberUser = User.Create("member@test.io", "member", "Sup3rSecret!", "Member User");

    public RemoveMemberCommandHandlerTests()
    {
        _handler = new RemoveMemberCommandHandler(
            _workspaceRepository, _userRepository, _preferencesRepository, _emailService, _userContext, _activityLogRepository, _cacheService, _unitOfWork);

        _workspaceRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Workspace.Create("Acme", "acme", null));
    }

    [Fact]
    public async Task Handle_ShouldRemoveMember_WhenOwnerRemovesMember()
    {
        _userContext.UserId.Returns(_ownerId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _userRepository.GetByIdAsync(_ownerId, Arg.Any<CancellationToken>()).Returns(_ownerUser);
        _userRepository.GetByIdAsync(_memberId, Arg.Any<CancellationToken>()).Returns(_memberUser);

        var command = new RemoveMemberCommand(_workspaceId, _memberId);

        await _handler.Handle(command, CancellationToken.None);

        await _workspaceRepository.Received(1).RemoveMemberAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>());
        await _cacheService.Received(1).RemoveAsync($"workspace-members:{_workspaceId}", Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(Arg.Is<ActivityLog>(log =>
            log.Action == "removed" && log.Target == "Member User from workspace"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldRemoveMember_WhenAdminRemovesMember()
    {
        _userContext.UserId.Returns(_adminId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _adminId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _userRepository.GetByIdAsync(_adminId, Arg.Any<CancellationToken>()).Returns(_adminUser);
        _userRepository.GetByIdAsync(_memberId, Arg.Any<CancellationToken>()).Returns(_memberUser);

        var command = new RemoveMemberCommand(_workspaceId, _memberId);

        await _handler.Handle(command, CancellationToken.None);

        await _workspaceRepository.Received(1).RemoveMemberAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowForbidden_WhenAdminRemovesAdmin()
    {
        _userContext.UserId.Returns(_adminId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _adminId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var command = new RemoveMemberCommand(_workspaceId, _memberId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowForbidden_WhenAdminRemovesOwner()
    {
        _userContext.UserId.Returns(_adminId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _adminId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _ownerId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);

        var command = new RemoveMemberCommand(_workspaceId, _ownerId);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenRemovingSelf()
    {
        _userContext.UserId.Returns(_memberId);
        _workspaceRepository.GetMemberRoleAsync(_workspaceId, _memberId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var command = new RemoveMemberCommand(_workspaceId, _memberId);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenWorkspaceDoesNotExist()
    {
        _workspaceRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((Workspace?)null);

        var command = new RemoveMemberCommand(Guid.NewGuid(), _memberId);

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

        var command = new RemoveMemberCommand(_workspaceId, _memberId);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().RemoveMemberAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}