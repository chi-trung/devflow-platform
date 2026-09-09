using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Tasks.Create;

public class CreateTaskItemCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public CreateTaskItemCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    private CreateTaskItemCommandHandler CreateHandler() =>
        new(_projectRepository, _taskItemRepository, _activityLogRepository, _userContext, _unitOfWork);

    [Fact]
    public async Task Handle_ShouldAssignMaxNumberPlusOne()
    {
        _taskItemRepository.GetMaxNumberAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(7);
        TaskItem? added = null;
        _taskItemRepository.When(r => r.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(call => added = call.Arg<TaskItem>());

        await CreateHandler().Handle(new CreateTaskItemCommand(
            _workspaceId, _project.Id, "New task", null, TaskItemPriority.Medium, null, null), CancellationToken.None);

        Assert.Equal(8, added!.Number);
    }

    [Fact]
    public async Task Handle_ShouldRetryWithNewNumber_OnUniqueViolation()
    {
        _taskItemRepository.GetMaxNumberAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(7, 8); // first Max+1 collides; re-query returns the winning task's 8
        TaskItem? added = null;
        _taskItemRepository.When(r => r.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(call => added = call.Arg<TaskItem>());

        // Npgsql embeds SQLSTATE 23505 (unique_violation) in the message.
        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(
                x => throw new Exception("23505: duplicate key value violates unique constraint \"ix_task_items_project_id_number\""),
                x => Task.FromResult(1));

        await CreateHandler().Handle(new CreateTaskItemCommand(
            _workspaceId, _project.Id, "New task", null, TaskItemPriority.Medium, null, null), CancellationToken.None);

        Assert.Equal(9, added!.Number);
        await _unitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenProjectInDifferentWorkspace()
    {
        var otherWorkspace = Guid.NewGuid();
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Project.Create(otherWorkspace, "DevFlow", "DEV", null));

        await Assert.ThrowsAsync<NotFoundException>(() => CreateHandler().Handle(
            new CreateTaskItemCommand(_workspaceId, _project.Id, "New task", null, TaskItemPriority.Medium, null, null),
            CancellationToken.None));
    }
}
