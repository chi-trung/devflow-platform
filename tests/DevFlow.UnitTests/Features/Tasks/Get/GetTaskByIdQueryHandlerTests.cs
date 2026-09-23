using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Get;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Get;

public class GetTaskByIdQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public GetTaskByIdQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _task = TaskItem.Create(_projectId, "Task", null, TaskItemPriority.Medium);
        _task.SetNumber(42);

        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _taskAttachmentRepository.GetByTaskIdsAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<TaskAttachment>>());
        _gitHubRepository.GetPullRequestsByProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<PullRequest>());
        _labelRepository.GetLabelIdsByTaskIdsAsync(Arg.Any<Guid>(), Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<Guid>>());
    }

    private GetTaskByIdQueryHandler CreateHandler() =>
        new(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _gitHubRepository, _labelRepository);

    [Fact]
    public async Task ShouldReturnTask_WithKeyAndMappedFields()
    {
        var handler = CreateHandler();
        var result = await handler.Handle(
            new GetTaskByIdQuery(_workspaceId, _projectId, _task.Id),
            CancellationToken.None);

        Assert.Equal(_task.Id, result.Id);
        Assert.Equal(_projectId, result.ProjectId);
        Assert.Equal("DEV-42", result.Key);
        Assert.Equal(42, result.Number);
        Assert.Equal("Task", result.Title);
        Assert.Equal(nameof(TaskItemStatus.Idea), result.Status);
        Assert.Equal(nameof(TaskItemPriority.Medium), result.Priority);
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenProjectMissing()
    {
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns((Project?)null);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskByIdQuery(_workspaceId, _projectId, _task.Id), CancellationToken.None));
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenProjectInDifferentWorkspace()
    {
        var foreign = Project.Create(Guid.NewGuid(), "Other", "OTH", null);
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(foreign);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskByIdQuery(_workspaceId, _projectId, _task.Id), CancellationToken.None));
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenTaskMissing()
    {
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns((TaskItem?)null);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskByIdQuery(_workspaceId, _projectId, _task.Id), CancellationToken.None));
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenTaskInDifferentProject()
    {
        var foreign = TaskItem.Create(Guid.NewGuid(), "Foreign", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(foreign.Id, Arg.Any<CancellationToken>()).Returns(foreign);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskByIdQuery(_workspaceId, _projectId, foreign.Id), CancellationToken.None));
    }
}
