using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Export;
using DevFlow.Application.Features.Import;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Import;

public class ImportHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;

    public ImportHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
    }

    private ImportProjectBackupHandler CreateHandler() =>
        new(_taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

    [Fact]
    public async Task Import_ShouldCreateTasksAndComments()
    {
        var taskId = Guid.NewGuid();
        var commentId = Guid.NewGuid();
        var backup = new ProjectBackupData
        {
            ProjectId = _projectId,
            ProjectName = "DevFlow",
            Tasks =
            {
                new TaskBackupDto { Id = taskId, Title = "Imported task", Status = "Backlog", Priority = "Medium" },
            },
            Comments =
            {
                new CommentDto { Id = commentId, TaskItemId = taskId, AuthorId = Guid.NewGuid(), Content = "A comment" },
            },
        };

        var handler = CreateHandler();
        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, JsonSerializer.Serialize(backup)),
            CancellationToken.None);

        Assert.Equal(1, result.TasksImported);
        Assert.Equal(1, result.CommentsImported);
        Assert.Empty(result.Errors);
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t => t.Title == "Imported task"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Import_WithInvalidJson_ShouldReturnError()
    {
        var handler = CreateHandler();
        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, "not-json"),
            CancellationToken.None);

        Assert.Equal(0, result.TasksImported);
        Assert.Contains(result.Errors, e => e.Contains("Invalid JSON"));
    }

    [Fact]
    public async Task Import_WithMissingProject_ShouldReturnError()
    {
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns((Project?)null);

        var handler = CreateHandler();
        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, "{}"),
            CancellationToken.None);

        Assert.Equal(0, result.TasksImported);
        Assert.Contains(result.Errors, e => e.Contains("Project not found"));
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Import_WithEmptyBackup_ShouldNotSave()
    {
        var handler = CreateHandler();
        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, JsonSerializer.Serialize(new ProjectBackupData())),
            CancellationToken.None);

        Assert.Equal(0, result.TasksImported);
        Assert.Equal(0, result.CommentsImported);
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
