using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Templates;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Templates;

public class TemplateHandlerTests
{
    private readonly ITemplateRepository _templateRepository = Substitute.For<ITemplateRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task Create_ShouldPersistTemplate_AndReturnId()
    {
        var handler = new CreateTemplateHandler(_templateRepository, _unitOfWork);
        var command = new CreateTemplateCommand(_workspaceId, _projectId, "Bug report", "Bug", "Template for bugs", "High", 60);

        var id = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        await _templateRepository.Received(1).AddAsync(Arg.Is<TaskTemplate>(t => t.Name == "Bug report"), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task List_ShouldReturnTemplates()
    {
        var template = TaskTemplate.Create(_projectId, "Bug report", "Bug", null, TaskItemPriority.High, 60);
        _templateRepository.GetByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskTemplate> { template });

        var handler = new ListTemplatesHandler(_templateRepository);
        var result = await handler.Handle(new ListTemplatesQuery(_workspaceId, _projectId), CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal("Bug report", item.Name);
        Assert.Equal("High", item.Priority);
        Assert.Equal(60, item.EstimateMinutes);
    }

    [Fact]
    public async Task Apply_ShouldCreateTaskFromTemplate()
    {
        var template = TaskTemplate.Create(_projectId, "Bug report", "Bug", "Description", TaskItemPriority.High, 60);
        _templateRepository.GetByIdAsync(template.Id, Arg.Any<CancellationToken>()).Returns(template);

        var handler = new ApplyTemplateHandler(_templateRepository, _taskItemRepository, _unitOfWork);
        var id = await handler.Handle(new ApplyTemplateCommand(_workspaceId, _projectId, template.Id), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Title == "Bug" && t.Priority == TaskItemPriority.High && t.EstimateMinutes == 60),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Apply_ShouldThrowNotFound_WhenTemplateMissing()
    {
        _templateRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((TaskTemplate?)null);

        var handler = new ApplyTemplateHandler(_templateRepository, _taskItemRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(new ApplyTemplateCommand(_workspaceId, _projectId, Guid.NewGuid()), CancellationToken.None));
    }
}
