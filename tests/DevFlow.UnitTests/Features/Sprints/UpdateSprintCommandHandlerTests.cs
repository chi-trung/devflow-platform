using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints;
using DevFlow.Application.Features.Sprints.Update;
using DevFlow.Application.Features.Templates;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class UpdateSprintCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly Sprint _sprint;

    public UpdateSprintCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _sprint = Sprint.Create(_project.Id, "Sprint 1", "Goal");

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _sprintRepository.GetByIdAsync(_sprint.Id, Arg.Any<CancellationToken>()).Returns(_sprint);
    }

    [Fact]
    public async Task Update_ShouldChangeNameAndGoal()
    {
        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new UpdateSprintCommand(_workspaceId, _project.Id, _sprint.Id, "Renamed", "New goal");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Renamed", result.Name);
        Assert.Equal("New goal", result.Goal);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_ShouldThrowNotFound_WhenSprintInOtherProject()
    {
        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new UpdateSprintCommand(_workspaceId, _project.Id, _sprint.Id, "Renamed", null);

        _sprintRepository.GetByIdAsync(_sprint.Id, Arg.Any<CancellationToken>())
            .Returns(Sprint.Create(Guid.NewGuid(), "Foreign", null));

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Update_WithEmptyName_ShouldThrowValidation()
    {
        var handler = new UpdateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);

        await Assert.ThrowsAsync<ValidationException>(() =>
            handler.Handle(new UpdateSprintCommand(_workspaceId, _project.Id, _sprint.Id, "", null), CancellationToken.None));
    }
}