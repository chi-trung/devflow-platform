using System.Text;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Attachments;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class UploadTaskAttachmentCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskAttachmentRepository _taskAttachmentRepository = Substitute.For<ITaskAttachmentRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public UploadTaskAttachmentCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Task A", null, TaskItemPriority.Medium);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    private UploadTaskAttachmentCommandHandler CreateHandler() =>
        new(_projectRepository, _taskItemRepository, _taskAttachmentRepository, _unitOfWork);

    private UploadTaskAttachmentCommand ValidCommand(byte[]? data = null)
    {
        var bytes = data ?? Encoding.UTF8.GetBytes("file content");
        return new UploadTaskAttachmentCommand(
            _workspaceId,
            _project.Id,
            _task.Id,
            "notes.txt",
            "text/plain",
            bytes.Length,
            bytes);
    }

    [Fact]
    public async Task Handle_ShouldStoreAttachment_WhenTypeIsAllowed()
    {
        var handler = CreateHandler();

        var result = await handler.Handle(ValidCommand(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("notes.txt", result.FileName);
        Assert.Equal("text/plain", result.ContentType);

        await _taskAttachmentRepository.Received(1).AddAsync(Arg.Any<TaskAttachment>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReject_OversizedFile()
    {
        var oversized = new byte[10 * 1024 * 1024 + 1];
        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, _project.Id, _task.Id, "big.pdf", "application/pdf", oversized.Length, oversized);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Contains("size limit", ex.Errors["File"][0]);

        await _taskAttachmentRepository.DidNotReceive().AddAsync(Arg.Any<TaskAttachment>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReject_BlockedExecutableExtension()
    {
        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, _project.Id, _task.Id, "payload.exe", "application/octet-stream", 100, new byte[100]);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Contains("not allowed", ex.Errors["File"][0]);

        await _taskAttachmentRepository.DidNotReceive().AddAsync(Arg.Any<TaskAttachment>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReject_DisallowedContentType()
    {
        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, _project.Id, _task.Id, "virus.bin", "application/x-msdownload", 100, new byte[100]);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));
        Assert.Contains("not allowed", ex.Errors["File"][0]);

        await _taskAttachmentRepository.DidNotReceive().AddAsync(Arg.Any<TaskAttachment>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReject_EmptyFile()
    {
        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, _project.Id, _task.Id, "empty.txt", "text/plain", 0, []);

        await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenProjectBelongsToDifferentWorkspace()
    {
        var foreignWorkspace = Guid.NewGuid();
        var foreignProject = Project.Create(foreignWorkspace, "Foreign", "FRG", null);
        _projectRepository.GetByIdAsync(foreignProject.Id, Arg.Any<CancellationToken>()).Returns(foreignProject);

        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, foreignProject.Id, _task.Id, "notes.txt", "text/plain", 11, new byte[11]);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenTaskDoesNotExist()
    {
        var missingTaskId = Guid.NewGuid();
        _taskItemRepository.GetByIdAsync(missingTaskId, Arg.Any<CancellationToken>()).Returns((TaskItem?)null);

        var handler = CreateHandler();

        var command = new UploadTaskAttachmentCommand(
            _workspaceId, _project.Id, missingTaskId, "notes.txt", "text/plain", 11, new byte[11]);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
