using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints.Update;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class UpdateSprintCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public UpdateSprintCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Handle_ShouldUpdateNameAndGoal_WhenSprintExists()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", "Old goal");
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        var command = new UpdateSprintCommand(_workspaceId, _project.Id, sprint.Id, "Sprint 2", "New goal");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Sprint 2", sprint.Name);
        Assert.Equal("New goal", sprint.Goal);
        Assert.Equal("Sprint 2", result.Name);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldAllowNullGoal()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", "Old goal");
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        var command = new UpdateSprintCommand(_workspaceId, _project.Id, sprint.Id, "Sprint 2", null);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Null(sprint.Goal);
        Assert.Null(result.Goal);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowValidation_WhenNameIsEmpty()
    {
        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        var command = new UpdateSprintCommand(_workspaceId, _project.Id, Guid.NewGuid(), "  ", null);

        await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));

        await _sprintRepository.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenSprintBelongsToDifferentProject()
    {
        var otherProject = Project.Create(Guid.NewGuid(), "Other", "OTH", null);
        var sprint = Sprint.Create(otherProject.Id, "Foreign sprint", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        var command = new UpdateSprintCommand(_workspaceId, _project.Id, sprint.Id, "Renamed", null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));

        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenSprintDoesNotExist()
    {
        var missingId = Guid.NewGuid();
        _sprintRepository.GetByIdAsync(missingId, Arg.Any<CancellationToken>()).Returns((Sprint?)null);

        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        var command = new UpdateSprintCommand(_workspaceId, _project.Id, missingId, "Renamed", null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
