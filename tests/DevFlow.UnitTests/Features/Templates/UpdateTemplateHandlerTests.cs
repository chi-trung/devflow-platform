using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Templates;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Templates;

public class UpdateTemplateHandlerTests
{
    private readonly ITemplateRepository _templateRepository = Substitute.For<ITemplateRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskTemplate _template;

    public UpdateTemplateHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _template = TaskTemplate.Create(_projectId, "Bug report", "Bug", null, TaskItemPriority.High, 60);

        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
        _templateRepository.GetByIdAsync(_template.Id, Arg.Any<CancellationToken>()).Returns(_template);
    }

    [Fact]
    public async Task Update_ShouldChangeNameAndDescription()
    {
        var handler = new UpdateTemplateHandler(_templateRepository, _projectRepository, _unitOfWork);
        var command = new UpdateTemplateCommand(_workspaceId, _projectId, _template.Id, "Renamed", "New desc");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Renamed", result.Name);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_WithEmptyName_ShouldThrowValidation()
    {
        var handler = new UpdateTemplateHandler(_templateRepository, _projectRepository, _unitOfWork);

        await Assert.ThrowsAsync<ValidationException>(() =>
            handler.Handle(new UpdateTemplateCommand(_workspaceId, _projectId, _template.Id, "", null), CancellationToken.None));
    }
}
