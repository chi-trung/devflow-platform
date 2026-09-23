using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Workspaces.InviteMembers;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class InviteMemberCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IWorkspaceInvitationRepository _invitationRepository = Substitute.For<IWorkspaceInvitationRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly InviteMemberCommandHandler _handler;
    private readonly User _invitedUser = User.Create("member@test.io", "member", "Sup3rSecret!", "Member");
    private readonly User _inviterUser = User.Create("admin@test.io", "admin", "Sup3rSecret!", "Admin User");
    private readonly Guid _inviterId = Guid.NewGuid();

    public InviteMemberCommandHandlerTests()
    {
        _handler = new InviteMemberCommandHandler(
            _workspaceRepository,
            _userRepository,
            _invitationRepository,
            _notificationRepository,
            _userContext,
            _emailService,
            _unitOfWork);

        _userRepository.GetByEmailAsync("member@test.io", Arg.Any<CancellationToken>())
            .Returns(_invitedUser);
        _userContext.UserId.Returns(_inviterId);
        _userRepository.GetByIdAsync(_inviterId, Arg.Any<CancellationToken>())
            .Returns(_inviterUser);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenUserDoesNotExist()
    {
        var command = new InviteMemberCommand(Guid.NewGuid(), "ghost@test.io", WorkspaceRole.Member);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        await _invitationRepository.DidNotReceive().AddAsync(Arg.Any<WorkspaceInvitation>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenUserIsAlreadyAMember()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _workspaceRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Workspace.Create("Acme", "acme", null));

        var command = new InviteMemberCommand(Guid.NewGuid(), "member@test.io", WorkspaceRole.Member);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
        await _invitationRepository.DidNotReceive().AddAsync(Arg.Any<WorkspaceInvitation>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenPendingInvitationAlreadyExists()
    {
        var workspaceId = Guid.NewGuid();
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);
        _workspaceRepository.GetByIdAsync(workspaceId, Arg.Any<CancellationToken>())
            .Returns(Workspace.Create("Acme", "acme", null));
        _invitationRepository.GetPendingAsync(workspaceId, _invitedUser.Id, Arg.Any<CancellationToken>())
            .Returns(WorkspaceInvitation.Create(workspaceId, _invitedUser.Id, "member@test.io", WorkspaceRole.Member, _inviterId));

        var command = new InviteMemberCommand(workspaceId, "member@test.io", WorkspaceRole.Member);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldCreatePendingInvitation_WithoutAddingMembership()
    {
        var workspaceId = Guid.NewGuid();
        var workspace = Workspace.Create("Acme", "acme", null);

        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);
        _workspaceRepository.GetByIdAsync(workspaceId, Arg.Any<CancellationToken>())
            .Returns(workspace);
        _invitationRepository.GetPendingAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceInvitation?)null);

        WorkspaceInvitation? captured = null;
        await _invitationRepository.AddAsync(Arg.Do<WorkspaceInvitation>(i => captured = i), Arg.Any<CancellationToken>());

        var command = new InviteMemberCommand(workspaceId, "member@test.io", WorkspaceRole.Admin);

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal(_invitedUser.Id, response.UserId);
        Assert.Equal("Admin", response.Role);

        // Must NOT become a member until Accept.
        await _workspaceRepository.DidNotReceive().AddMemberAsync(
            Arg.Any<Workspace>(), Arg.Any<Guid>(), Arg.Any<WorkspaceRole>(), Arg.Any<CancellationToken>());
        await _invitationRepository.Received(1).AddAsync(Arg.Any<WorkspaceInvitation>(), Arg.Any<CancellationToken>());
        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == _invitedUser.Id &&
                n.Type == "WorkspaceInvited" &&
                n.WorkspaceId == workspaceId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        Assert.NotNull(captured);
        Assert.Equal(InvitationStatus.Pending, captured!.Status);
        Assert.Equal(WorkspaceRole.Admin, captured.Role);
        Assert.Equal(_inviterId, captured.InvitedByUserId);
        Assert.Equal("member@test.io", captured.InvitedEmail);
    }
}
