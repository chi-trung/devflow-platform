using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Tasks;

/// <summary>
/// Number is non-nullable and unique per project (TaskItemConfiguration's
/// (project_id, number) index). Every path that creates a task row has to fill
/// it, or the row keeps the CLR default of 0 and the *second* one in a project
/// is rejected by the database as a unique violation.
/// </summary>
public class TaskNumberAssignerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private static readonly Guid ProjectId = Guid.NewGuid();

    private Task Save(TaskItem task) =>
        TaskNumberAssigner.SaveWithNumberAsync(
            task, _taskItemRepository, _unitOfWork, ProjectId, CancellationToken.None);

    [Fact]
    public async Task ShouldAssignMaxNumberPlusOne()
    {
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(7);
        var task = TaskItem.Create(ProjectId, "A task", null, TaskItemPriority.Medium);

        await Save(task);

        Assert.Equal(8, task.Number);
        await _taskItemRepository.Received(1).AddAsync(task, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task FirstTaskInEmptyProject_ShouldGetOne_NotZero()
    {
        // An empty project returns 0 from Max(), so a naive "+ 1" is the only
        // thing standing between a brand-new project and a task numbered 0.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(0);
        var task = TaskItem.Create(ProjectId, "First", null, TaskItemPriority.Medium);

        await Save(task);

        Assert.Equal(1, task.Number);
    }

    [Fact]
    public async Task ShouldRetryWithANewNumber_WhenTwoWritersRace()
    {
        // Both callers compute Max+1 from the same snapshot; the index is the
        // only real arbiter, so the loser has to re-read and try again.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>())
            .Returns(7, 8);
        var task = TaskItem.Create(ProjectId, "A task", null, TaskItemPriority.Medium);

        // Npgsql embeds SQLSTATE 23505 (unique_violation) in the message text.
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(
                _ => throw new Exception("23505: duplicate key value violates unique constraint \"ix_task_items_project_id_number\""),
                _ => Task.FromResult(1));

        await Save(task);

        Assert.Equal(9, task.Number);
        await _unitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldGiveUpAfterTheBoundedRetries_RatherThanLoopForever()
    {
        // A permanently unsatisfiable insert must surface as the database's own
        // error, not as a hang.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(7);
        var task = TaskItem.Create(ProjectId, "A task", null, TaskItemPriority.Medium);

        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<Task<int>>(_ => throw new Exception("23505: duplicate key value violates unique constraint"));

        var ex = await Assert.ThrowsAsync<Exception>(() => Save(task));

        Assert.Contains("23505", ex.Message);
        await _unitOfWork.Received(3).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldNotRetry_WhenTheFailureIsNotAUniqueViolation()
    {
        // A connection drop or a validation error is not a lost race. Retrying
        // it would re-send the insert for a reason the database will reject
        // just the same.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(7);
        var task = TaskItem.Create(ProjectId, "A task", null, TaskItemPriority.Medium);

        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<Task<int>>(_ => throw new Exception("connection reset"));

        var ex = await Assert.ThrowsAsync<Exception>(() => Save(task));

        Assert.Equal("connection reset", ex.Message);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // --- Batch: rows staged together and saved once ------------------------

    [Fact]
    public async Task Batch_ShouldCountUpFromTheCurrentMax()
    {
        // Rows staged in the same context are not in the table yet. A per-row
        // read would return the same max every time and hand every row the
        // same number, which the (project_id, number) index then rejects.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(4);
        var batch = new TaskNumberAssigner.Batch(_taskItemRepository, ProjectId);

        var tasks = Enumerable.Range(0, 3)
            .Select(i => TaskItem.Create(ProjectId, $"Task {i}", null, TaskItemPriority.Medium))
            .ToArray();

        foreach (var task in tasks)
        {
            await batch.AssignAsync(task, CancellationToken.None);
        }

        Assert.Equal(new[] { 5, 6, 7 }, tasks.Select(t => t.Number).ToArray());

        // One read for the whole batch, not one per row.
        await _taskItemRepository.Received(1).GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Batch_ShouldStartAtOne_InAnEmptyProject()
    {
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(0);
        var batch = new TaskNumberAssigner.Batch(_taskItemRepository, ProjectId);

        var only = TaskItem.Create(ProjectId, "First ever", null, TaskItemPriority.Medium);
        await batch.AssignAsync(only, CancellationToken.None);

        Assert.Equal(1, only.Number);
    }

    [Fact]
    public async Task Batch_ShouldNotRepeatANumber_WhenTheProjectAlreadyHasGaps()
    {
        // Soft-deleted tasks keep occupying their number, so a project can
        // easily read 0, 1, 2, 8. The batch must start above the highest, not
        // fill the gap — and must not hand the same number to two rows.
        _taskItemRepository.GetMaxNumberAsync(ProjectId, Arg.Any<CancellationToken>()).Returns(8);
        var batch = new TaskNumberAssigner.Batch(_taskItemRepository, ProjectId);

        var tasks = Enumerable.Range(0, 2)
            .Select(i => TaskItem.Create(ProjectId, $"Task {i}", null, TaskItemPriority.Medium))
            .ToArray();

        foreach (var task in tasks)
        {
            await batch.AssignAsync(task, CancellationToken.None);
        }

        Assert.Equal(new[] { 9, 10 }, tasks.Select(t => t.Number).ToArray());
    }
}
