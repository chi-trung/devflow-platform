using System.Reflection;
using DevFlow.Api.Controllers;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Import;
using DevFlow.Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression (wave 5b hand-audit): POST .../import/tasks was an anonymous
/// write. ImportController had no [Authorize] (and Program.cs has no fallback
/// auth policy), ProcessImport created TaskItems straight through the
/// repository, ignored the route's workspaceId entirely, and — because no
/// command ran — never invalidated the cached board pages. Anyone with a
/// project id could inject tasks into any project. The writes now ride
/// ImportTasksCommand (IProjectRequest + [RequireWorkspaceRole]) behind a
/// class-level [Authorize]; this test locks all four properties so none can
/// silently regress.
/// </summary>
public class ImportTasksCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project = Project.Create(Guid.NewGuid(), "Import Target", "IMP", null);
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    public ImportTasksCacheInvalidationTests()
    {
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    private ImportTasksCommand Command() => new(
        _project.WorkspaceId,
        _project.Id,
        new[] { new ImportTaskRow("Imported", null, "Todo", "High") });

    private ImportTasksCommandHandler BuildHandler() =>
        new(_projectRepository, _taskItemRepository, _unitOfWork);

    // ── Authentication ─────────────────────────────────────────────────────

    [Fact]
    public void ImportController_ShouldRequireAuthentication()
    {
        // Program.cs has no fallback policy — a controller without
        // [Authorize] is anonymous. This one was, for a write endpoint.
        Assert.NotNull(typeof(ImportController)
            .GetCustomAttribute<AuthorizeAttribute>(inherit: false));
    }

    // ── Tenant + membership authorization ──────────────────────────────────

    [Fact]
    public void ImportTasksCommand_ShouldDeclareWorkspaceRoleAttribute()
    {
        var attribute = typeof(ImportTasksCommand)
            .GetCustomAttributes(typeof(RequireWorkspaceRoleAttribute), inherit: false)
            .Cast<RequireWorkspaceRoleAttribute>()
            .FirstOrDefault();

        Assert.NotNull(attribute);
        Assert.True(attribute!.MinimumRole >= WorkspaceRoleMemberFloor,
            "Import must at least require workspace membership.");
    }

    private static readonly Domain.Enums.WorkspaceRole WorkspaceRoleMemberFloor =
        Domain.Enums.WorkspaceRole.Member;

    [Fact]
    public async Task Handler_ShouldThrow_WhenProjectIsNotInRouteWorkspace()
    {
        await Assert.ThrowsAsync<NotFoundException>(() =>
            BuildHandler().Handle(
                new ImportTasksCommand(Guid.NewGuid(), _project.Id,
                    new[] { new ImportTaskRow("Alien", null, "Idea", "Medium") }),
                CancellationToken.None));

        await _taskItemRepository.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    // ── Cache invalidation + realtime ──────────────────────────────────────

    [Fact]
    public async Task Command_ShouldInvalidateProjectCacheTag()
    {
        var behavior = new CacheInvalidationBehavior<ImportTasksCommand, ImportTasksResult>(_cache);
        await behavior.Handle(
            Command(),
            _ => Task.FromResult(new ImportTasksResult(1, 0, [])),
            CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_project.Id}");
    }

    [Fact]
    public async Task Command_ShouldNotifyRealtimeProject()
    {
        var notifier = Substitute.For<IRealtimeNotifier>();

        var behavior = new RealtimeBehavior<ImportTasksCommand, ImportTasksResult>(notifier);
        await behavior.Handle(
            Command(),
            _ => Task.FromResult(new ImportTasksResult(1, 0, [])),
            CancellationToken.None);

        await notifier.Received(1).NotifyProjectAsync(
            _project.Id, nameof(ImportTasksCommand), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void Command_ShouldNotFloodActivityFeed()
    {
        // Bulk import: no per-task activity row (same reasoning as
        // ImportProjectBackupCommand — the empty verb makes ActivityBehavior skip).
        Assert.Equal("", ((IProjectEvent)Command()).ActivityVerb);
    }

    // ── Handler behavior ───────────────────────────────────────────────────

    [Fact]
    public async Task Handler_ShouldCreateTasks_AndSave()
    {
        var result = await BuildHandler().Handle(
            new ImportTasksCommand(_project.WorkspaceId, _project.Id, new[]
            {
                new ImportTaskRow("  Ship it  ", "  desc  ", "InProgress", "High"),
                new ImportTaskRow("", null, "Idea", "Medium"),          // blank title → skipped
                new ImportTaskRow("Bad status", null, "Nope", "Medium"), // bad enum → error
            }),
            CancellationToken.None);

        Assert.Equal(1, result.Imported);
        Assert.Equal(2, result.Skipped);
        Assert.Single(result.Errors);
        Assert.Contains("Nope", result.Errors[0]);

        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(t =>
                t.Title == "Ship it" &&
                t.Description == "desc" &&
                t.ProjectId == _project.Id &&
                t.Status == Domain.Enums.TaskItemStatus.InProgress),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
