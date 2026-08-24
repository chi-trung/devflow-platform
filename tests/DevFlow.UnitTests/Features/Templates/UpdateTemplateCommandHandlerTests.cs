using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Templates;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Templates;

public class UpdateTemplateCommandHandlerTests
{
    private readonly ITemplateRepository _templateRepository = Substitute.For<ITemplateRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public UpdateTemplateCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    private UpdateTemplateHandler CreateHandler() =>
        new(_templateRepository, _projectRepository, _unitOfWork);

    [Fact]
    public async Task Handle_ShouldUpdateNameAndDescription()
    {
        var template = TaskTemplate.Create(_project.Id, "Bug report", "Bug", "Old desc", TaskItemPriority.High, 60);
        _templateRepository.GetByIdAsync(template.Id, Arg.Any<CancellationToken>()).Returns(template);

        var handler = CreateHandler();

        var command = new UpdateTemplateCommand(_workspaceId, _project.Id, template.Id, "Bug report v2", "New desc");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Bug report v2", template.Name);
        Assert.Equal("New desc", template.Description);
        Assert.Equal("Bug report v2", result.Name);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowValidation_WhenNameIsEmpty()
    {
        var handler = CreateHandler();

        var command = new UpdateTemplateCommand(_workspaceId, _project.Id, Guid.NewGuid(), "  ", null);

        await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));

        await _templateRepository.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenTemplateDoesNotExist()
    {
        var missingId = Guid.NewGuid();
        _templateRepository.GetByIdAsync(missingId, Arg.Any<CancellationToken>()).Returns((TaskTemplate?)null);

        var handler = CreateHandler();

        var command = new UpdateTemplateCommand(_workspaceId, _project.Id, missingId, "Renamed", null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenProjectBelongsToDifferentWorkspace()
    {
        var foreignProject = Project.Create(Guid.NewGuid(), "Foreign", "FRG", null);
        _projectRepository.GetByIdAsync(foreignProject.Id, Arg.Any<CancellationToken>()).Returns(foreignProject);

        var template = TaskTemplate.Create(foreignProject.Id, "Bug", "Bug", null, TaskItemPriority.Medium, null);
        _templateRepository.GetByIdAsync(template.Id, Arg.Any<CancellationToken>()).Returns(template);

        var handler = CreateHandler();

        var command = new UpdateTemplateCommand(_workspaceId, foreignProject.Id, template.Id, "Renamed", null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
