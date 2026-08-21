using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Workspaces.Create;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Workspaces;

public class CreateWorkspaceCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();

    private readonly CreateWorkspaceCommandHandler _handler;

    public CreateWorkspaceCommandHandlerTests()
    {
        _handler = new CreateWorkspaceCommandHandler(_workspaceRepository, _unitOfWork, _userContext);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenSlugAlreadyExists()
    {
        _workspaceRepository.ExistsBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new CreateWorkspaceCommand("Acme", "acme", null);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldCreateWorkspaceWithOwnerMembership_WhenInputIsValid()
    {
        var userId = Guid.NewGuid();
        _userContext.UserId.Returns(userId);
        _workspaceRepository.ExistsBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new CreateWorkspaceCommand("Acme", "acme", "Acme workspace");

        var workspaceId = await _handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, workspaceId);
        await _workspaceRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.Workspace>(workspace =>
                workspace.Slug == "acme" &&
                workspace.Members.Single().UserId == userId &&
                workspace.Members.Single().Role == Domain.Enums.WorkspaceRole.Owner),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
