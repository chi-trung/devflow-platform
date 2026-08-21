using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.InviteMembers;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class InviteMemberCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly InviteMemberCommandHandler _handler;
    private readonly User _invitedUser = User.Create("member@test.io", "member", "Sup3rSecret!", "Member");

    public InviteMemberCommandHandlerTests()
    {
        _handler = new InviteMemberCommandHandler(_workspaceRepository, _userRepository, _unitOfWork);
        _userRepository.GetByEmailAsync("member@test.io", Arg.Any<CancellationToken>())
            .Returns(_invitedUser);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenUserDoesNotExist()
    {
        var command = new InviteMemberCommand(Guid.NewGuid(), "ghost@test.io", WorkspaceRole.Member);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenUserIsAlreadyAMember()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var command = new InviteMemberCommand(Guid.NewGuid(), "member@test.io", WorkspaceRole.Member);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldAddMembership_AndPersist()
    {
        var workspaceId = Guid.NewGuid();
        var workspace = Workspace.Create("Acme", "acme", null);

        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);
        _workspaceRepository.GetByIdAsync(workspaceId, Arg.Any<CancellationToken>())
            .Returns(workspace);

        var command = new InviteMemberCommand(workspaceId, "member@test.io", WorkspaceRole.Admin);

        var response = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal(_invitedUser.Id, response.UserId);
        Assert.Equal("Admin", response.Role);
        await _workspaceRepository.Received(1).AddMemberAsync(
            workspace,
            _invitedUser.Id,
            WorkspaceRole.Admin,
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
