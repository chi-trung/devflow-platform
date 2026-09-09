using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tasks.List;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.List;

public class LabelIdsHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public LabelIdsHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Labeled task", null, TaskItemPriority.Medium);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);

        _taskItemRepository.GetCountForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(1);
        _taskItemRepository.GetForProjectPagedAsync(_project.Id, (TaskItemStatus?)null, 0, 20, Arg.Any<CancellationToken>())
            .Returns(new[] { _task });

        _taskAttachmentRepository.GetByTaskIdsAsync(
                Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<TaskAttachment>>());

        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<PullRequest>());

        // Cache miss by default — always invoke the loader factory.
        _cache.GetOrSetAsync(
                Arg.Any<string>(),
                Arg.Any<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(),
                Arg.Any<TimeSpan?>(),
                Arg.Any<IEnumerable<string>?>(),
                Arg.Any<CancellationToken>())
            .Returns(info => info.ArgAt<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(1)(CancellationToken.None));
    }

    private async Task<IReadOnlyList<Guid>?> HandleAsync(
        IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> labelIdsByTask)
    {
        _labelRepository.GetLabelIdsByTaskIdsAsync(
                _project.Id, Arg.Any<IReadOnlyCollection<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(labelIdsByTask);

        var handler = new ListTaskItemsQueryHandler(
            _projectRepository, _taskItemRepository, _taskAttachmentRepository, _gitHubRepository,
            _labelRepository, _cache);
        var result = await handler.Handle(
            new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        return result.Items.Single().LabelIds;
    }

    [Fact]
    public async Task LabelIds_ShouldComeFromBatchLookup()
    {
        var labelId = Guid.NewGuid();

        var ids = await HandleAsync(new Dictionary<Guid, IReadOnlyList<Guid>>
        {
            [_task.Id] = [labelId]
        });

        Assert.NotNull(ids);
        Assert.Single(ids);
        Assert.Equal(labelId, ids[0]);
    }

    [Fact]
    public async Task LabelIds_ShouldBeNull_WhenTaskHasNoLabels()
    {
        // The batch dictionary simply omits unlabeled tasks; GetValueOrDefault
        // yields null (not an empty list) so the payload stays lean.
        var ids = await HandleAsync(new Dictionary<Guid, IReadOnlyList<Guid>>());

        Assert.Null(ids);
    }

    [Fact]
    public async Task LabelIds_ShouldBeRequestedOnce_ForTheWholePage()
    {
        await HandleAsync(new Dictionary<Guid, IReadOnlyList<Guid>>());

        await _labelRepository.Received(1).GetLabelIdsByTaskIdsAsync(
            _project.Id, Arg.Is<IReadOnlyCollection<Guid>>(ids => ids.Contains(_task.Id)),
            Arg.Any<CancellationToken>());
    }
}
