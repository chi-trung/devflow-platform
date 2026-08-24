using System.Text;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Export;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Export;

public class ExportHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public ExportHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _task = TaskItem.Create(_projectId, "Fix CORS", "Config issue", TaskItemPriority.High);
        _task.ChangeStatus(TaskItemStatus.Done);
        _task.SetEstimate(60);

        _projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { _task });
    }

    [Fact]
    public async Task ExportTasks_Csv_ShouldIncludeHeaderAndRows()
    {
        var handler = new ExportProjectTasksHandler(_taskItemRepository, _projectRepository);
        var result = await handler.Handle(
            new ExportProjectTasksQuery(_workspaceId, _projectId, "csv"),
            CancellationToken.None);

        Assert.Equal("DevFlow-tasks.csv", result.FileName);
        Assert.Equal("text/csv", result.ContentType);

        var text = Encoding.UTF8.GetString(result.Data);
        Assert.Contains("Id,Title,Description,Status,Priority", text);
        Assert.Contains("Fix CORS", text);
    }

    [Fact]
    public async Task ExportTasks_Json_ShouldSerializeTasks()
    {
        var handler = new ExportProjectTasksHandler(_taskItemRepository, _projectRepository);
        var result = await handler.Handle(
            new ExportProjectTasksQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);

        Assert.Equal("application/json", result.ContentType);
        var text = Encoding.UTF8.GetString(result.Data);
        Assert.Contains("Fix CORS", text);
        Assert.Contains("Done", text);
    }

    [Fact]
    public async Task ExportBackup_ShouldIncludeTasksEpicsSprints()
    {
        var epic = Epic.Create(_projectId, "Epic 1", null);
        var sprint = Sprint.Create(_projectId, "Sprint 1", null);

        _epicRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>()).Returns(new[] { epic });
        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>()).Returns(new[] { sprint });
        _commentRepository.GetForTaskAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(new List<Comment>());

        var handler = new ExportProjectBackupHandler(
            _taskItemRepository, _epicRepository, _sprintRepository, _commentRepository, _projectRepository);
        var result = await handler.Handle(
            new ExportProjectBackupQuery(_workspaceId, _projectId, "json"),
            CancellationToken.None);

        Assert.EndsWith("backup.json", result.FileName);
        var text = Encoding.UTF8.GetString(result.Data);
        Assert.Contains("Epic 1", text);
        Assert.Contains("Sprint 1", text);
        Assert.Contains("Fix CORS", text);
    }
}
