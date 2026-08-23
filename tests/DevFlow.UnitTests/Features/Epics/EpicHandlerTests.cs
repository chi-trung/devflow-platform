using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Epics.Create;
using DevFlow.Application.Features.Epics.Delete;
using DevFlow.Application.Features.Epics.List;
using DevFlow.Application.Features.Epics.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Epics;

public class EpicHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public EpicHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Create_ShouldPersistEpic()
    {
        var handler = new CreateEpicCommandHandler(_projectRepository, _epicRepository, _unitOfWork);
        var command = new CreateEpicCommand(
            _workspaceId, _project.Id, "Sprint 18 Epic", "Hierarchy support",
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(30));

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.Id);
        await _epicRepository.Received(1).AddAsync(Arg.Any<Epic>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectMissing()
    {
        var handler = new CreateEpicCommandHandler(_projectRepository, _epicRepository, _unitOfWork);
        var command = new CreateEpicCommand(
            _workspaceId, Guid.NewGuid(), "Ghost Epic", null, null, null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldComputeProgressFromTasks()
    {
        var epic = Epic.Create(_project.Id, "Roadmap", null);
        var done = TaskItem.Create(_project.Id, "Done task", null, TaskItemPriority.Medium);
        done.AttachToEpic(epic.Id);
        done.ChangeStatus(TaskItemStatus.Done);
        done.SetStoryPoints(5);

        var open = TaskItem.Create(_project.Id, "Open task", null, TaskItemPriority.Medium);
        open.AttachToEpic(epic.Id);
        open.SetStoryPoints(3);

        var unrelated = TaskItem.Create(_project.Id, "No epic", null, TaskItemPriority.Low);

        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { epic });
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { done, open, unrelated });

        var handler = new ListEpicsQueryHandler(_projectRepository, _epicRepository, _taskItemRepository);
        var result = await handler.Handle(new ListEpicsQuery(_workspaceId, _project.Id), CancellationToken.None);

        var response = Assert.Single(result);
        Assert.Equal(2, response.TotalTasks);
        Assert.Equal(1, response.CompletedTasks);
        Assert.Equal(50, response.CompletionPercent);
        Assert.Equal(8, response.TotalStoryPoints);
        Assert.Equal(5, response.CompletedStoryPoints);
    }

    [Fact]
    public async Task Update_ShouldThrowNotFound_WhenEpicInOtherProject()
    {
        var otherProjectId = Guid.NewGuid();
        var epic = Epic.Create(otherProjectId, "Other", null);
        _epicRepository.GetByIdAsync(epic.Id, Arg.Any<CancellationToken>()).Returns(epic);

        var handler = new UpdateEpicCommandHandler(_projectRepository, _epicRepository, _unitOfWork);
        var command = new UpdateEpicCommand(
            _workspaceId, _project.Id, epic.Id, "Renamed", null, null, null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldRemoveEpic()
    {
        var epic = Epic.Create(_project.Id, "Doomed", null);
        _epicRepository.GetByIdAsync(epic.Id, Arg.Any<CancellationToken>()).Returns(epic);

        var handler = new DeleteEpicCommandHandler(_projectRepository, _epicRepository, _unitOfWork);
        await handler.Handle(new DeleteEpicCommand(_workspaceId, _project.Id, epic.Id), CancellationToken.None);

        await _epicRepository.Received(1).RemoveAsync(epic, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
