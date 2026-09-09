using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tasks.List;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;namespace DevFlow.UnitTests.Features.Caching;

public class ListTaskItemsCacheTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;

    public ListTaskItemsCacheTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskAttachmentRepository.GetByTaskIdsAsync(
                Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<TaskAttachment>>());
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<PullRequest>());
        _labelRepository.GetLabelIdsByTaskIdsAsync(
                _project.Id, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<Guid>>());
    }

    [Fact]
    public async Task ShouldUseProjectScopedCacheKey()
    {
        var task = TaskItem.Create(_project.Id, "Cached task", null, TaskItemPriority.Medium);
        _taskItemRepository.GetCountForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(1);
        _taskItemRepository.GetForProjectPagedAsync(_project.Id, (TaskItemStatus?)null, 0, 20, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _gitHubRepository, _labelRepository, _cache);
        var query = new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20);

        await handler.Handle(query, CancellationToken.None);

        var expectedKey = $"tasks:{_project.Id}:all:1:20";
        await _cache.Received(1).GetOrSetAsync<PagedResult<TaskItemResponse>>(
            expectedKey,
            Arg.Any<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(),
            Arg.Any<TimeSpan?>(),
            Arg.Is<IEnumerable<string>>(tags => tags.Contains($"project:{_project.Id}")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldCachePerStatusAndPage()
    {
        var task = TaskItem.Create(_project.Id, "Cached task", null, TaskItemPriority.Medium);
        _taskItemRepository.GetCountForProjectAsync(_project.Id, TaskItemStatus.Done, Arg.Any<CancellationToken>())
            .Returns(1);
        _taskItemRepository.GetForProjectPagedAsync(_project.Id, TaskItemStatus.Done, 20, 20, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _gitHubRepository, _labelRepository, _cache);
        var query = new ListTaskItemsQuery(_workspaceId, _project.Id, TaskItemStatus.Done, 2, 20);

        await handler.Handle(query, CancellationToken.None);

        await _cache.Received(1).GetOrSetAsync<PagedResult<TaskItemResponse>>(
            $"tasks:{_project.Id}:Done:2:20",
            Arg.Any<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(),
            Arg.Any<TimeSpan?>(),
            Arg.Any<IEnumerable<string>?>(),
            Arg.Any<CancellationToken>());
    }
}