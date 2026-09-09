using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tasks.List;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.List;

public class PullRequestSummaryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public PullRequestSummaryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Ship the badge", null, TaskItemPriority.Medium);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);

        _taskItemRepository.GetCountForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(1);
        _taskItemRepository.GetForProjectPagedAsync(_project.Id, (TaskItemStatus?)null, 0, 20, Arg.Any<CancellationToken>())
            .Returns(new[] { _task });

        _taskAttachmentRepository.GetByTaskIdsAsync(
                Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, IReadOnlyList<TaskAttachment>>());

        // Cache miss by default — always invoke the loader factory.
        _cache.GetOrSetAsync(
                Arg.Any<string>(),
                Arg.Any<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(),
                Arg.Any<TimeSpan?>(),
                Arg.Any<IEnumerable<string>?>(),
                Arg.Any<CancellationToken>())
            .Returns(info => info.ArgAt<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(1)(CancellationToken.None));
    }

    private PullRequest Pr(Guid? linkedTaskId, string status)
    {
        var pr = PullRequest.Create(_project.Id, "some pr", $"https://github.com/acme/devflow/pull/{Guid.NewGuid():N}", status, "bob");
        if (linkedTaskId.HasValue)
        {
            pr.LinkToTask(linkedTaskId.Value);
        }

        return pr;
    }

    private async Task<PullRequestSummary?> HandleAsync(params PullRequest[] prs)
    {
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(prs);

        var handler = new ListTaskItemsQueryHandler(
            _projectRepository, _taskItemRepository, _taskAttachmentRepository, _gitHubRepository, _cache);
        var result = await handler.Handle(
            new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        return result.Items.Single().PrSummary;
    }

    [Fact]
    public async Task Summary_ShouldBucketCounts_CaseInsensitively()
    {
        // legacy lowercase "open" counted with "Open"; "Merged"/"merged" both.
        var summary = await HandleAsync(
            Pr(_task.Id, "Open"),
            Pr(_task.Id, "open"),
            Pr(_task.Id, "merged"),
            Pr(_task.Id, "Closed"));

        Assert.NotNull(summary);
        Assert.Equal(2, summary!.Open);
        Assert.Equal(1, summary.Merged);
        Assert.Equal(1, summary.Closed);
    }

    [Fact]
    public async Task Summary_ShouldBeNull_WhenTaskHasNoLinkedPrs()
    {
        Assert.Null(await HandleAsync());
    }

    [Fact]
    public async Task Summary_ShouldIgnoreUnlinkedPrs()
    {
        Assert.Null(await HandleAsync(Pr(linkedTaskId: null, "Open")));
    }

    [Fact]
    public async Task Summary_ShouldNotCountPrsLinkedToOtherTasks()
    {
        var otherTask = TaskItem.Create(_project.Id, "other", null, TaskItemPriority.Low);

        var summary = await HandleAsync(
            Pr(otherTask.Id, "Open"),
            Pr(otherTask.Id, "Merged"),
            Pr(_task.Id, "Closed"));

        Assert.NotNull(summary);
        Assert.Equal(0, summary!.Open);
        Assert.Equal(0, summary.Merged);
        Assert.Equal(1, summary.Closed);
    }
}
