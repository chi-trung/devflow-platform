using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Projects.Create;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Projects;

public class CreateProjectCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly CreateProjectCommandHandler _handler;

    public CreateProjectCommandHandlerTests()
    {
        _handler = new CreateProjectCommandHandler(_projectRepository, _unitOfWork);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenKeyAlreadyUsedInWorkspace()
    {
        _projectRepository.KeyExistsInWorkspaceAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(true);

        var command = new CreateProjectCommand(Guid.NewGuid(), "DevFlow Core", "DEV", null);

        await Assert.ThrowsAsync<ConflictException>(() => _handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldNormalizeKeyToUpperCase_AndPersistProject()
    {
        _projectRepository.KeyExistsInWorkspaceAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(false);

        var command = new CreateProjectCommand(Guid.NewGuid(), "DevFlow Core", "dev", "Core platform");

        var projectId = await _handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, projectId);
        await _projectRepository.Received(1).AddAsync(
            Arg.Is<Domain.Entities.Project>(project => project.Key == "DEV"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
