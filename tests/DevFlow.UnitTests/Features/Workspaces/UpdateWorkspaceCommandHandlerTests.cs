using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class UpdateWorkspaceCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();

    private readonly UpdateWorkspaceCommandHandler _handler;

    public UpdateWorkspaceCommandHandlerTests()
    {
        _handler = new UpdateWorkspaceCommandHandler(_workspaceRepository, _userContext, _unitOfWork);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    [Fact]
    public async Task Handle_ShouldUpdateNameAndDescription_WhenWorkspaceExists()
    {
        var workspace = Workspace.Create("Acme", "acme", "Old description");
        _workspaceRepository.GetByIdAsync(workspace.Id, Arg.Any<CancellationToken>()).Returns(workspace);
        _workspaceRepository.GetMemberRoleAsync(workspace.Id, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var command = new UpdateWorkspaceCommand(workspace.Id, "Acme Corp", "New description");

        var result = await _handler.Handle(command, CancellationToken.None);

        Assert.Equal("Acme Corp", workspace.Name);
        Assert.Equal("New description", workspace.Description);
        Assert.Equal("Acme Corp", result.Name);
        Assert.Equal("Admin", result.Role);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowValidation_WhenNameIsEmpty()
    {
        var command = new UpdateWorkspaceCommand(Guid.NewGuid(), "  ", null);

        await Assert.ThrowsAsync<ValidationException>(() => _handler.Handle(command, CancellationToken.None));

        await _workspaceRepository.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenWorkspaceDoesNotExist()
    {
        var missingId = Guid.NewGuid();
        _workspaceRepository.GetByIdAsync(missingId, Arg.Any<CancellationToken>()).Returns((Workspace?)null);

        var command = new UpdateWorkspaceCommand(missingId, "Acme", null);

        await Assert.ThrowsAsync<NotFoundException>(() => _handler.Handle(command, CancellationToken.None));
    }
}
