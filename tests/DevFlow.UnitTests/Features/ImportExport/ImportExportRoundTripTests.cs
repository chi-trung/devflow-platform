using System.Reflection;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Export;
using DevFlow.Application.Features.Import;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using System.Text.Json;

namespace DevFlow.UnitTests.Features.ImportExport;

public class ImportExportRoundTripTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;

    private static readonly PropertyInfo IdProperty =
        typeof(Domain.Common.BaseEntity).GetProperty(nameof(Domain.Common.BaseEntity.Id))!;

    public ImportExportRoundTripTests()
    {
        _project = Project.Create(_workspaceId, "Test Project", "TP", null);
        IdProperty.SetValue(_project, _projectId);
    }

    [Fact]
    public async Task RoundTrip_ShouldPreserveTaskData()
    {
        // Arrange: create tasks in the source project
        var task1 = TaskItem.Create(_projectId, "Fix login bug", "Fix the login issue", TaskItemPriority.High);
        var task2 = TaskItem.Create(_projectId, "Add dark mode", "Implement dark theme", TaskItemPriority.Medium);
        task2.ChangeStatus(TaskItemStatus.InProgress);

        var tasks = new[] { task1, task2 };
        _taskItemRepository.GetForProjectAsync(_projectId, null, Arg.Any<CancellationToken>())
            .Returns(tasks);

        var epic = Epic.Create(_projectId, "Mobile App", "Mobile app epic");
        _epicRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { epic });

        var sprint = Sprint.Create(_projectId, "Sprint 1", "First sprint");
        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { sprint });

        _commentRepository.GetForTaskAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Comment>());

        // Act: export
        var exportHandler = new ExportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository);

        var exportResult = await exportHandler.Handle(
            new ExportProjectBackupQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);

        // Verify export contains data
        Assert.NotNull(exportResult.Data);
        Assert.Equal("application/json", exportResult.ContentType);

        var json = System.Text.Encoding.UTF8.GetString(exportResult.Data);
        var backup = JsonSerializer.Deserialize<ProjectBackupData>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        Assert.NotNull(backup);
        Assert.Equal(2, backup.Tasks.Count);
        Assert.Single(backup.Epics);
        Assert.Single(backup.Sprints);
        Assert.Equal("Fix login bug", backup.Tasks[0].Title);
        Assert.Equal("High", backup.Tasks[0].Priority);
        Assert.Equal("Mobile App", backup.Epics[0].Name);
        Assert.Equal("Sprint 1", backup.Sprints[0].Name);

        // Act: import into a new project
        var newProjectId = Guid.NewGuid();
        var newProject = Project.Create(_workspaceId, "New Project", "NP", null);
        IdProperty.SetValue(newProject, newProjectId);

        _projectRepository.GetByIdAsync(newProjectId, Arg.Any<CancellationToken>())
            .Returns(newProject);

        // Track imported entities
        var importedTasks = new List<TaskItem>();
        var importedEpics = new List<Epic>();
        var importedSprints = new List<Sprint>();
        var importedComments = new List<Comment>();

        _taskItemRepository.When(x => x.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(x => importedTasks.Add(x.Arg<TaskItem>()));
        _epicRepository.When(x => x.AddAsync(Arg.Any<Epic>(), Arg.Any<CancellationToken>()))
            .Do(x => importedEpics.Add(x.Arg<Epic>()));
        _sprintRepository.When(x => x.AddAsync(Arg.Any<Sprint>(), Arg.Any<CancellationToken>()))
            .Do(x => importedSprints.Add(x.Arg<Sprint>()));
        _commentRepository.When(x => x.AddAsync(Arg.Any<Comment>(), Arg.Any<CancellationToken>()))
            .Do(x => importedComments.Add(x.Arg<Comment>()));

        var importHandler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var importResult = await importHandler.Handle(
            new ImportProjectBackupCommand(_workspaceId, newProjectId, json),
            CancellationToken.None);

        // Assert
        Assert.Equal(2, importResult.TasksImported);
        Assert.Equal(1, importResult.EpicsImported);
        Assert.Equal(1, importResult.SprintsImported);
        Assert.Empty(importResult.Errors);

        // Verify imported tasks have correct data
        Assert.Equal(2, importedTasks.Count);
        Assert.Equal("Fix login bug", importedTasks[0].Title);
        Assert.Equal(TaskItemPriority.High, importedTasks[0].Priority);
        Assert.Equal("Add dark mode", importedTasks[1].Title);
        Assert.Equal(TaskItemStatus.InProgress, importedTasks[1].Status);

        // Verify IDs are different (remapped)
        Assert.NotEqual(task1.Id, importedTasks[0].Id);
        Assert.NotEqual(task2.Id, importedTasks[1].Id);
        Assert.NotEqual(epic.Id, importedEpics[0].Id);
        Assert.NotEqual(sprint.Id, importedSprints[0].Id);

        // Verify IDs are new GUIDs (not empty)
        Assert.NotEqual(Guid.Empty, importedTasks[0].Id);
        Assert.NotEqual(Guid.Empty, importedEpics[0].Id);
    }

    [Fact]
    public async Task RoundTrip_ShouldPreserveComments()
    {
        // Arrange
        var task = TaskItem.Create(_projectId, "Task with comments", null, TaskItemPriority.Medium);
        var tasks = new[] { task };
        _taskItemRepository.GetForProjectAsync(_projectId, null, Arg.Any<CancellationToken>())
            .Returns(tasks);

        _epicRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Epic>());
        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Sprint>());

        var comment = Comment.Create(task.Id, Guid.NewGuid(), "This is a test comment");
        var commentTime = new DateTimeOffset(2026, 2, 3, 10, 0, 0, TimeSpan.Zero);
        comment.CreatedAtUtc = commentTime;
        _commentRepository.GetForTaskAsync(task.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { comment });

        // Act: export
        var exportHandler = new ExportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository);

        var exportResult = await exportHandler.Handle(
            new ExportProjectBackupQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);

        var json = System.Text.Encoding.UTF8.GetString(exportResult.Data);

        // Act: import
        var newProjectId = Guid.NewGuid();
        var newProject = Project.Create(_workspaceId, "New", "NP", null);
        IdProperty.SetValue(newProject, newProjectId);
        _projectRepository.GetByIdAsync(newProjectId, Arg.Any<CancellationToken>())
            .Returns(newProject);

        var importedComments = new List<Comment>();
        _commentRepository.When(x => x.AddAsync(Arg.Any<Comment>(), Arg.Any<CancellationToken>()))
            .Do(x => importedComments.Add(x.Arg<Comment>()));

        var importHandler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var importResult = await importHandler.Handle(
            new ImportProjectBackupCommand(_workspaceId, newProjectId, json),
            CancellationToken.None);

        // Assert
        Assert.Equal(1, importResult.CommentsImported);
        Assert.Single(importedComments);
        Assert.Equal("This is a test comment", importedComments[0].Content);
        // Without the restore, Comment.Create re-stamps "now" and the
        // conversation's original dates (and order) are silently lost.
        Assert.Equal(commentTime, importedComments[0].CreatedAtUtc);
    }

    [Fact]
    public async Task RoundTrip_ShouldPreserveDueDatesAndSprintLifecycle()
    {
        // The original round-trip test only carried plain tasks and a Planned
        // sprint, so the import silently dropping task DueDateUtc and the
        // sprint Status/StartDate/EndDate/CompletedAt went unnoticed.
        var due = new DateTimeOffset(2026, 3, 15, 9, 0, 0, TimeSpan.Zero);
        var task = TaskItem.Create(_projectId, "Deadline task", null, TaskItemPriority.High);
        task.UpdateDetails("Deadline task", null, TaskItemPriority.High, due);

        _taskItemRepository.GetForProjectAsync(_projectId, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });
        _epicRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Epic>());

        var start = new DateTimeOffset(2026, 1, 5, 0, 0, 0, TimeSpan.Zero);
        var end = new DateTimeOffset(2026, 1, 19, 0, 0, 0, TimeSpan.Zero);
        var sprint = Sprint.Create(_projectId, "Sprint 7", "Ship it");
        sprint.Start(start, end);
        sprint.Complete();
        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { sprint });

        _commentRepository.GetForTaskAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Comment>());

        var exportHandler = new ExportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository);

        var exportResult = await exportHandler.Handle(
            new ExportProjectBackupQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);
        var json = System.Text.Encoding.UTF8.GetString(exportResult.Data);

        var newProjectId = Guid.NewGuid();
        var newProject = Project.Create(_workspaceId, "Restored", "RS", null);
        IdProperty.SetValue(newProject, newProjectId);
        _projectRepository.GetByIdAsync(newProjectId, Arg.Any<CancellationToken>())
            .Returns(newProject);

        var importedTasks = new List<TaskItem>();
        var importedSprints = new List<Sprint>();
        _taskItemRepository.When(x => x.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(x => importedTasks.Add(x.Arg<TaskItem>()));
        _sprintRepository.When(x => x.AddAsync(Arg.Any<Sprint>(), Arg.Any<CancellationToken>()))
            .Do(x => importedSprints.Add(x.Arg<Sprint>()));

        var importHandler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var importResult = await importHandler.Handle(
            new ImportProjectBackupCommand(_workspaceId, newProjectId, json),
            CancellationToken.None);

        Assert.Empty(importResult.Errors);
        Assert.Equal(due, Assert.Single(importedTasks).DueDateUtc);

        var restored = Assert.Single(importedSprints);
        Assert.Equal(SprintStatus.Completed, restored.Status);
        Assert.Equal(start, restored.StartDateUtc);
        Assert.Equal(end, restored.EndDateUtc);
        Assert.Equal(sprint.CompletedAtUtc, restored.CompletedAtUtc);
    }

    [Fact]
    public async Task RoundTrip_ShouldPreserveTaskLifecycleTimestamps()
    {
        // TaskBackupDto carried no CompletedAtUtc/StartedAtUtc and the import
        // never called RestoreTimestamps, so every restored Done task came
        // back stamped with the import instant — silently rewriting cycle time
        // and every burndown drawn from completion history.
        var started = new DateTimeOffset(2026, 1, 6, 8, 0, 0, TimeSpan.Zero);
        var reviewed = new DateTimeOffset(2026, 1, 9, 15, 30, 0, TimeSpan.Zero);
        var completed = new DateTimeOffset(2026, 1, 12, 17, 0, 0, TimeSpan.Zero);

        var task = TaskItem.Create(_projectId, "Shipped feature", null, TaskItemPriority.High);
        task.ChangeStatus(TaskItemStatus.InProgress);
        task.RestoreTimestamps(started, null, null);
        task.ChangeStatus(TaskItemStatus.Review);
        task.RestoreTimestamps(null, null, reviewed);
        task.ChangeStatus(TaskItemStatus.Done);
        task.RestoreTimestamps(null, completed, null);
        Assert.Equal(completed, task.CompletedAtUtc);

        _taskItemRepository.GetForProjectAsync(_projectId, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });
        _epicRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Epic>());
        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Sprint>());
        _commentRepository.GetForTaskAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Comment>());

        var exportHandler = new ExportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository);

        var exportResult = await exportHandler.Handle(
            new ExportProjectBackupQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);
        var json = System.Text.Encoding.UTF8.GetString(exportResult.Data);

        var newProjectId = Guid.NewGuid();
        var newProject = Project.Create(_workspaceId, "Restored", "RS", null);
        IdProperty.SetValue(newProject, newProjectId);
        _projectRepository.GetByIdAsync(newProjectId, Arg.Any<CancellationToken>())
            .Returns(newProject);

        var importedTasks = new List<TaskItem>();
        _taskItemRepository.When(x => x.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(x => importedTasks.Add(x.Arg<TaskItem>()));

        var importHandler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var importResult = await importHandler.Handle(
            new ImportProjectBackupCommand(_workspaceId, newProjectId, json),
            CancellationToken.None);

        Assert.Empty(importResult.Errors);
        var restored = Assert.Single(importedTasks);
        Assert.Equal(TaskItemStatus.Done, restored.Status);
        Assert.Equal(started, restored.StartedAtUtc);
        Assert.Equal(reviewed, restored.EnteredReviewAtUtc);
        Assert.Equal(completed, restored.CompletedAtUtc);
        // The corruption signature: import time masquerading as completion time.
        Assert.True(restored.CompletedAtUtc < DateTimeOffset.UtcNow.AddMinutes(-1));
    }

    [Fact]
    public async Task Import_ShouldReturnError_WhenJsonIsInvalid()
    {
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(_project);

        var handler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, "not valid json {{{"),
            CancellationToken.None);

        Assert.Single(result.Errors);
        Assert.Contains("Invalid JSON", result.Errors[0]);
        Assert.Equal(0, result.TasksImported);
    }

    [Fact]
    public async Task Import_ShouldReturnError_WhenProjectNotFound()
    {
        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns((Project?)null);

        var handler = new ImportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository, _unitOfWork);

        var result = await handler.Handle(
            new ImportProjectBackupCommand(_workspaceId, _projectId, "{}"),
            CancellationToken.None);

        Assert.Single(result.Errors);
        Assert.Contains("Project not found", result.Errors[0]);
    }
}
