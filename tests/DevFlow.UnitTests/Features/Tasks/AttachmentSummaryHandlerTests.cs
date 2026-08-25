using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Tasks;
using DevFlow.Application.Features.Tasks.List;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class AttachmentSummaryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly ICacheService _cache = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public AttachmentSummaryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);

        // Cache miss by default — always invoke the loader factory.
        _cache.GetOrSetAsync(
                Arg.Any<string>(),
                Arg.Any<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(),
                Arg.Any<TimeSpan?>(),
                Arg.Any<IEnumerable<string>?>(),
                Arg.Any<CancellationToken>())
            .Returns(info => info.ArgAt<Func<CancellationToken, Task<PagedResult<TaskItemResponse>>>>(1)(CancellationToken.None));
    }

    private TaskItem NewTask() => TaskItem.Create(_project.Id, "Task with attachments", null, TaskItemPriority.Medium);

    private void StubPage(TaskItem task, params TaskAttachment[] attachments)
    {
        _taskItemRepository.GetCountForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(1);
        _taskItemRepository.GetForProjectPagedAsync(_project.Id, (TaskItemStatus?)null, 0, 20, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var grouped = attachments.Length == 0
            ? new Dictionary<Guid, IReadOnlyList<TaskAttachment>>()
            : new Dictionary<Guid, IReadOnlyList<TaskAttachment>>
            {
                [task.Id] = attachments
            };
        _taskAttachmentRepository.GetByTaskIdsAsync(
                Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(grouped);
    }

    private static TaskAttachment Attachment(TaskItem task, string name, string contentType) =>
        TaskAttachment.Create(task.Id, name, contentType, 100, new byte[100]);

    [Fact]
    public async Task Summary_ShouldCountAllAttachments_AndExposeUpToThreeImagePreviews()
    {
        var task = NewTask();
        var attachments = new[]
        {
            Attachment(task, "a.png", "image/png"),
            Attachment(task, "b.png", "image/png"),
            Attachment(task, "c.png", "image/png"),
            Attachment(task, "d.png", "image/png"),
            Attachment(task, "notes.pdf", "application/pdf")
        };
        StubPage(task, attachments);

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _cache);
        var result = await handler.Handle(new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        var summary = Assert.IsType<TaskItemResponse>(Assert.Single(result.Items)).AttachmentSummary;
        Assert.NotNull(summary);
        Assert.Equal(5, summary.Count);
        Assert.Equal(3, summary.Previews.Count);
        Assert.All(summary.Previews, preview => Assert.StartsWith("image/", preview.ContentType));
    }

    [Fact]
    public async Task Summary_ShouldExcludeNonImageAttachments_FromPreviews_ButStillCountThem()
    {
        var task = NewTask();
        var attachments = new[]
        {
            Attachment(task, "report.pdf", "application/pdf"),
            Attachment(task, "sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Attachment(task, "photo.jpg", "image/jpeg")
        };
        StubPage(task, attachments);

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _cache);
        var result = await handler.Handle(new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        var summary = Assert.IsType<TaskItemResponse>(Assert.Single(result.Items)).AttachmentSummary;
        Assert.NotNull(summary);
        Assert.Equal(3, summary.Count);
        var preview = Assert.Single(summary.Previews);
        Assert.Equal("image/jpeg", preview.ContentType);
        Assert.Equal(attachments[2].Id, preview.Id);
    }

    [Fact]
    public async Task Summary_ShouldBeNull_WhenTaskHasNoAttachments()
    {
        var task = NewTask();
        StubPage(task);

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _cache);
        var result = await handler.Handle(new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        var response = Assert.IsType<TaskItemResponse>(Assert.Single(result.Items));
        Assert.Null(response.AttachmentSummary);
    }

    [Fact]
    public async Task Summary_ShouldFallBackToNoPreviews_WhenAllAttachmentsAreNonImage()
    {
        var task = NewTask();
        var attachments = new[]
        {
            Attachment(task, "notes.txt", "text/plain"),
            Attachment(task, "archive.zip", "application/zip")
        };
        StubPage(task, attachments);

        var handler = new ListTaskItemsQueryHandler(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _cache);
        var result = await handler.Handle(new ListTaskItemsQuery(_workspaceId, _project.Id, null, 1, 20), CancellationToken.None);

        var summary = Assert.IsType<TaskItemResponse>(Assert.Single(result.Items)).AttachmentSummary;
        Assert.NotNull(summary);
        Assert.Equal(2, summary.Count);
        Assert.Empty(summary.Previews);
    }
}
