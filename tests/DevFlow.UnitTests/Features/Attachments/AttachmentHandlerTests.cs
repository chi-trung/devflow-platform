using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Tasks.Attachments;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Attachments;

public class AttachmentListAndDownloadTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _attachmentRepository = Substitute.For<ITaskAttachmentRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public AttachmentListAndDownloadTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _task = TaskItem.Create(_projectId, "Task", null, TaskItemPriority.Medium);

        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    private TaskAttachment MakeAttachment(string name, string contentType) =>
        TaskAttachment.Create(_task.Id, name, contentType, 10, [1, 2, 3]);

    [Fact]
    public async Task List_ShouldReturnPagedSubset_WithTotal()
    {
        var all = Enumerable.Range(0, 15)
            .Select(i => MakeAttachment($"f{i}.txt", "text/plain"))
            .ToList();

        _attachmentRepository.GetForTaskPagedAsync(_task.Id, 0, 10, Arg.Any<CancellationToken>())
            .Returns((all.Take(10).ToList(), all.Count));

        var handler = new ListTaskAttachmentsQueryHandler(_projectRepository, _taskItemRepository, _attachmentRepository);
        var result = await handler.Handle(
            new ListTaskAttachmentsQuery(_workspaceId, _projectId, _task.Id, 1, 10),
            CancellationToken.None);

        Assert.Equal(10, result.Items.Count);
        Assert.Equal(15, result.TotalCount);
        Assert.Equal(1, result.Page);
        Assert.Equal(10, result.PageSize);
    }

    [Fact]
    public async Task List_ShouldRespectPageSkip()
    {
        var all = Enumerable.Range(0, 15)
            .Select(i => MakeAttachment($"f{i}.txt", "text/plain"))
            .ToList();

        _attachmentRepository.GetForTaskPagedAsync(_task.Id, 10, 10, Arg.Any<CancellationToken>())
            .Returns((all.Skip(10).Take(10).ToList(), all.Count));

        var handler = new ListTaskAttachmentsQueryHandler(_projectRepository, _taskItemRepository, _attachmentRepository);
        var result = await handler.Handle(
            new ListTaskAttachmentsQuery(_workspaceId, _projectId, _task.Id, 2, 10),
            CancellationToken.None);

        Assert.Equal(5, result.Items.Count);
        Assert.Equal(15, result.TotalCount);
    }

    [Fact]
    public async Task Download_ShouldReturnFileResult_WithCreatedAt()
    {
        var attachment = MakeAttachment("photo.png", "image/png");
        _attachmentRepository.GetByIdAsync(attachment.Id, Arg.Any<CancellationToken>()).Returns(attachment);

        var handler = new DownloadTaskAttachmentQueryHandler(_projectRepository, _taskItemRepository, _attachmentRepository);
        var result = await handler.Handle(
            new DownloadTaskAttachmentQuery(_workspaceId, _projectId, _task.Id, attachment.Id),
            CancellationToken.None);

        Assert.Equal("photo.png", result.FileName);
        Assert.Equal("image/png", result.ContentType);
        Assert.Equal(attachment.CreatedAtUtc, result.CreatedAtUtc);
    }
}
