using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.AttachToEpic;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression (wave 5b hand-audit): "add_to_epic" was the only task mutation
/// that bypassed the command pipeline — the AI executor called task.AttachToEpic
/// and saved directly. EpicId ships on every cached board card
/// (tasks:{projectId}, tag project:{projectId}), so the board kept showing the
/// OLD epic for the full 30s TTL and realtime clients never woke.
/// AttachTaskToEpicCommand now carries IProjectEvent like every sibling; this
/// test locks the behavior so a future refactor back to a direct mutation
/// cannot silently drop the marker.
/// </summary>
public class AttachTaskToEpicCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly Epic _epic;
    private readonly TaskItem _task;
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public AttachTaskToEpicCacheInvalidationTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _epic = Epic.Create(_project.Id, "Auth", null);
        _task = TaskItem.Create(_project.Id, "Login screen", null, TaskItemPriority.High);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _epicRepository.GetByIdAsync(_epic.Id, Arg.Any<CancellationToken>()).Returns(_epic);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    private AttachTaskToEpicCommand Command() =>
        new(_workspaceId, _project.Id, _epic.Id, _task.Id);

    [Fact]
    public async Task Handler_ShouldAttachEpic_AndSave()
    {
        var handler = new AttachTaskToEpicCommandHandler(
            _projectRepository, _epicRepository, _taskItemRepository, _unitOfWork);

        await handler.Handle(Command(), CancellationToken.None);

        Assert.Equal(_epic.Id, _task.EpicId);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handler_ShouldThrow_WhenEpicBelongsToAnotherProject()
    {
        // A cross-project epic id would silently poison EpicId with an id no
        // board in this project can render — must be a 404, not an attach.
        var foreignProject = Project.Create(_workspaceId, "Other", "OTH", null);
        var foreignEpic = Epic.Create(foreignProject.Id, "Foreign", null);
        _epicRepository.GetByIdAsync(foreignEpic.Id, Arg.Any<CancellationToken>()).Returns(foreignEpic);

        var handler = new AttachTaskToEpicCommandHandler(
            _projectRepository, _epicRepository, _taskItemRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new AttachTaskToEpicCommand(_workspaceId, _project.Id, foreignEpic.Id, _task.Id),
                CancellationToken.None));

        Assert.Null(_task.EpicId);
    }

    [Fact]
    public async Task Command_ShouldInvalidateProjectCacheTag()
    {
        var behavior = new CacheInvalidationBehavior<AttachTaskToEpicCommand, Unit>(_cache);
        await behavior.Handle(Command(), _ => Task.FromResult(Unit.Value), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_project.Id}");
    }

    [Fact]
    public async Task Command_ShouldNotifyRealtimeProject()
    {
        var notifier = Substitute.For<IRealtimeNotifier>();

        var behavior = new RealtimeBehavior<AttachTaskToEpicCommand, Unit>(notifier);
        await behavior.Handle(Command(), _ => Task.FromResult(Unit.Value), CancellationToken.None);

        await notifier.Received(1).NotifyProjectAsync(
            _project.Id, nameof(AttachTaskToEpicCommand), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void Command_ShouldLogActivity_ForTheAffectedTask()
    {
        // Unlike rollover/import, the epic move has no per-entity log of its
        // own anywhere, so the behavior pipeline must write one.
        var projectEvent = (IProjectEvent)Command();
        Assert.Equal("added task to epic", projectEvent.ActivityVerb);
        Assert.Equal(_task.Id, projectEvent.ActivityTaskId);
    }
}
