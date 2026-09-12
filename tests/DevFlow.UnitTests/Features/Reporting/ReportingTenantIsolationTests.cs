using System.Reflection;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Reporting;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Reporting;

/// <summary>
/// Regression suite for the wave-5b hand-audit finding: every project-scoped
/// reporting query used to be an IWorkspaceRequest whose handler never tied
/// the route's workspaceId to the projectId, so any member of any workspace
/// could read another tenant's burndown/velocity/lead-time data by naming
/// their own workspaceId with a foreign projectId.
/// </summary>
public class ReportingTenantIsolationTests
{
    private readonly Project _project = Project.Create(Guid.NewGuid(), "Reporting Target", "RPT", null);
    private readonly Guid _workspaceId;
    private readonly Guid _projectId;
    private readonly Guid _foreignWorkspaceId = Guid.NewGuid();

    public ReportingTenantIsolationTests()
    {
        _workspaceId = _project.WorkspaceId;
        _projectId = _project.Id;
    }

    [Theory]
    [InlineData(typeof(GetBurndownQuery))]
    [InlineData(typeof(GetVelocityQuery))]
    [InlineData(typeof(GetCycleLeadTimeQuery))]
    [InlineData(typeof(GetVelocityHistoryQuery))]
    public void ProjectScopedQueries_ShouldDeclareIProjectRequest(Type queryType)
    {
        // The marker interface is what the authorization filter uses to
        // validate the project/workspace pairing — if someone flips these
        // records back to IWorkspaceRequest the routes silently leak again.
        Assert.True(typeof(IProjectRequest).IsAssignableFrom(queryType),
            $"{queryType.Name} must implement IProjectRequest so the tenant pairing is enforced.");
    }

    // --- Cross-tenant rejection (the leak itself) -------------------------

    [Fact]
    public async Task Burndown_ForeignWorkspace_ShouldThrowNotFound_AndNotReadTasks()
    {
        var reportingRepository = Substitute.For<IReportingRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var handler = new GetBurndownHandler(reportingRepository, projectRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetBurndownQuery(_foreignWorkspaceId, _projectId, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 5)),
            CancellationToken.None));

        await reportingRepository.DidNotReceive().GetTasksByProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Burndown_MissingProject_ShouldThrowNotFound()
    {
        var reportingRepository = Substitute.For<IReportingRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        projectRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Project?)null);

        var handler = new GetBurndownHandler(reportingRepository, projectRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetBurndownQuery(_workspaceId, Guid.NewGuid(), new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 5)),
            CancellationToken.None));

        await reportingRepository.DidNotReceive().GetTasksByProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Velocity_ForeignWorkspace_ShouldThrowNotFound_AndNotReadSprintsOrTasks()
    {
        var reportingRepository = Substitute.For<IReportingRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var handler = new GetVelocityHandler(reportingRepository, projectRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetVelocityQuery(_foreignWorkspaceId, _projectId),
            CancellationToken.None));

        await reportingRepository.DidNotReceive().GetSprintsByProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await reportingRepository.DidNotReceive().GetTasksByProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CycleLeadTime_ForeignWorkspace_ShouldThrowNotFound_BeforeTouchingCache()
    {
        // The tenant check must run BEFORE the cache lookup — otherwise a
        // foreign probe still gets a cache hit (or populates one) keyed off
        // the real project's rows.
        var taskItemRepository = Substitute.For<ITaskItemRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        var cacheService = Substitute.For<ICacheService>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var handler = new GetCycleLeadTimeHandler(taskItemRepository, projectRepository, cacheService);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetCycleLeadTimeQuery(_foreignWorkspaceId, _projectId),
            CancellationToken.None));

        await cacheService.DidNotReceiveWithAnyArgs()
            .GetOrSetAsync<CycleLeadTimeResponse>(default!, default!, default!, default!, default!);
        await taskItemRepository.DidNotReceive().GetForProjectAsync(Arg.Any<Guid>(), Arg.Any<TaskItemStatus?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task VelocityHistory_ForeignWorkspace_ShouldThrowNotFound_BeforeTouchingCache()
    {
        var sprintRepository = Substitute.For<ISprintRepository>();
        var taskItemRepository = Substitute.For<ITaskItemRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        var cacheService = Substitute.For<ICacheService>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var handler = new GetVelocityHistoryHandler(sprintRepository, taskItemRepository, projectRepository, cacheService);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetVelocityHistoryQuery(_foreignWorkspaceId, _projectId),
            CancellationToken.None));

        await cacheService.DidNotReceiveWithAnyArgs()
            .GetOrSetAsync<VelocityHistoryResponse>(default!, default!, default!, default!, default!);
        await sprintRepository.DidNotReceive().GetForProjectAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    // --- Same-tenant happy paths keep working ------------------------------

    [Fact]
    public async Task Burndown_OwningWorkspace_ShouldComputeRemainingAndIdeal()
    {
        var reportingRepository = Substitute.For<IReportingRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var start = new DateOnly(2026, 1, 1);
        var end = new DateOnly(2026, 1, 4); // 3-day window -> 4 points

        var doneEarly = TaskItem.Create(_projectId, "Done on Jan 2", null, TaskItemPriority.Medium);
        doneEarly.ChangeStatus(TaskItemStatus.Done);
        SetCompletedAt(doneEarly, new DateTimeOffset(2026, 1, 2, 8, 0, 0, TimeSpan.Zero));

        var doneLater = TaskItem.Create(_projectId, "Done on Jan 4", null, TaskItemPriority.Medium);
        doneLater.ChangeStatus(TaskItemStatus.Done);
        SetCompletedAt(doneLater, new DateTimeOffset(2026, 1, 4, 8, 0, 0, TimeSpan.Zero));

        var open = TaskItem.Create(_projectId, "Still open", null, TaskItemPriority.Low);

        reportingRepository.GetTasksByProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { doneEarly, doneLater, open });

        var handler = new GetBurndownHandler(reportingRepository, projectRepository);
        var result = await handler.Handle(
            new GetBurndownQuery(_workspaceId, _projectId, start, end),
            CancellationToken.None);

        Assert.Equal(3, result.TotalTasks);
        Assert.Equal(start, result.StartDate);
        Assert.Equal(end, result.EndDate);
        Assert.Equal(4, result.Points.Count);

        // remaining: nobody done on Jan 1, one by Jan 2, one by Jan 3, two by Jan 4
        Assert.Equal(new[] { 3, 2, 2, 1 }, result.Points.Select(p => p.RemainingTasks));
        // ideal: linear 3 -> 0 across the window
        Assert.Equal(new[] { 3, 2, 1, 0 }, result.Points.Select(p => p.IdealRemaining));
    }

    [Fact]
    public async Task Velocity_OwningWorkspace_ShouldAggregatePerSprintAndAverage()
    {
        var reportingRepository = Substitute.For<IReportingRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);

        var sprintA = Sprint.Create(_projectId, "A", null);
        var sprintB = Sprint.Create(_projectId, "B", null);

        var a1 = Done("A1", sprintA.Id);
        var a2 = Done("A2", sprintA.Id);
        var b1 = TaskItem.Create(_projectId, "B1", null, TaskItemPriority.Medium);
        b1.AssignToSprint(sprintB.Id);
        b1.ChangeStatus(TaskItemStatus.Done);
        var b2 = TaskItem.Create(_projectId, "B2", null, TaskItemPriority.Medium);
        b2.AssignToSprint(sprintB.Id);

        // The fixed repository yields dated sprints first, newest end date
        // first; this stub mirrors that order so the handler aggregation is
        // what's under test.
        reportingRepository.GetSprintsByProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { sprintB, sprintA });
        reportingRepository.GetTasksByProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { a1, a2, b1, b2 });

        var handler = new GetVelocityHandler(reportingRepository, projectRepository);
        var result = await handler.Handle(
            new GetVelocityQuery(_workspaceId, _projectId),
            CancellationToken.None);

        Assert.Equal(2, result.Sprints.Count);

        var b = result.Sprints.Single(s => s.SprintId == sprintB.Id);
        Assert.Equal(2, b.TotalTasks);
        Assert.Equal(1, b.CompletedTasks);
        Assert.Equal(0.5, b.CompletionRate);

        var a = result.Sprints.Single(s => s.SprintId == sprintA.Id);
        Assert.Equal(2, a.TotalTasks);
        Assert.Equal(2, a.CompletedTasks);
        Assert.Equal(1.0, a.CompletionRate);

        Assert.Equal(0.75, result.AverageCompletionRate);
    }

    [Fact]
    public async Task CycleLeadTime_OwningWorkspace_ShouldHitCacheAndCompute()
    {
        var taskItemRepository = Substitute.For<ITaskItemRepository>();
        var projectRepository = Substitute.For<IProjectRepository>();
        var cacheService = Substitute.For<ICacheService>();
        projectRepository.GetByIdAsync(_projectId, Arg.Any<CancellationToken>()).Returns(_project);
        cacheService.GetOrSetAsync<CycleLeadTimeResponse>(
                Arg.Any<string>(), Arg.Any<Func<CancellationToken, Task<CycleLeadTimeResponse>>>(),
                Arg.Any<TimeSpan?>(), Arg.Any<IEnumerable<string>?>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.ArgAt<Func<CancellationToken, Task<CycleLeadTimeResponse>>>(1)(CancellationToken.None));

        var created = DateTimeOffset.UtcNow.AddDays(-10);
        var done = TaskItem.Create(_projectId, "Finished", null, TaskItemPriority.Medium);
        done.ChangeStatus(TaskItemStatus.Done);
        SetCompletedAt(done, created.AddDays(4));
        SetCreatedAt(done, created);

        taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { done });

        var handler = new GetCycleLeadTimeHandler(taskItemRepository, projectRepository, cacheService);
        var result = await handler.Handle(
            new GetCycleLeadTimeQuery(_workspaceId, _projectId),
            CancellationToken.None);

        Assert.Single(result.Tasks);
        Assert.Equal(4.0, result.CycleTimeP50);
        // Same-tenant reads must still go through the cache with the
        // project tag, or invalidation loses them.
        await cacheService.Received(1).GetOrSetAsync<CycleLeadTimeResponse>(
            $"cycle-lead-time:{_projectId}",
            Arg.Any<Func<CancellationToken, Task<CycleLeadTimeResponse>>>(),
            Arg.Any<TimeSpan?>(),
            Arg.Is<IEnumerable<string>>(tags => tags.Contains($"project:{_projectId}")),
            Arg.Any<CancellationToken>());
    }

    private static TaskItem Done(string title, Guid sprintId)
    {
        var task = TaskItem.Create(Guid.NewGuid(), title, null, TaskItemPriority.Medium);
        task.AssignToSprint(sprintId);
        task.ChangeStatus(TaskItemStatus.Done);
        return task;
    }

    private static void SetCompletedAt(TaskItem task, DateTimeOffset value)
    {
        typeof(TaskItem).GetProperty(nameof(TaskItem.CompletedAtUtc))!.SetValue(task, value);
    }

    private static void SetCreatedAt(TaskItem task, DateTimeOffset value)
    {
        typeof(TaskItem).GetProperty(nameof(TaskItem.CreatedAtUtc))!.SetValue(task, value);
    }
}
