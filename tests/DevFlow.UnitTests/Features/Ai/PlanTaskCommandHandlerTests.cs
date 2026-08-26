using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

public class PlanTaskCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IKnowledgeRepository _knowledgeRepository = Substitute.For<IKnowledgeRepository>();
    private readonly IAiPlanRepository _aiPlanRepository = Substitute.For<IAiPlanRepository>();
    private readonly IAiClient _aiClient = Substitute.For<IAiClient>();
    private readonly AiPlanApplier _planApplier;
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public PlanTaskCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Add AI planner", "Break this down.", TaskItemPriority.High);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _userContext.UserId.Returns(_userId);
        _knowledgeRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<KnowledgeEntry>());

        var unitOfWork = _unitOfWork;
        _planApplier = new AiPlanApplier(_taskItemRepository, unitOfWork);
    }

    private PlanTaskCommandHandler BuildHandler() => new(
        _projectRepository,
        _taskItemRepository,
        _knowledgeRepository,
        _aiPlanRepository,
        _aiClient,
        _planApplier,
        _userContext,
        _unitOfWork);

    private static string SamplePlanJson(
        string summary = "Break down the work",
        int subtaskCount = 2)
    {
        var subtasks = Enumerable.Range(0, subtaskCount)
            .Select(i => new
            {
                title = $"Subtask {i + 1}",
                description = $"Do step {i + 1}",
                priority = i == 0 ? "High" : "Medium",
            })
            .ToList();

        return JsonSerializer.Serialize(new
        {
            summary,
            steps = new[] { "Plan", "Execute" },
            subtasks,
            definitionOfDone = new[] { "Tests pass", "Docs updated" },
        });
    }

    [Fact]
    public async Task Handle_ShouldPersistPlan_AsPending_WhenSelfApprovalOff()
    {
        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(SamplePlanJson());

        var handler = BuildHandler();
        var response = await handler.Handle(
            new PlanTaskCommand(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        Assert.Equal(AiPlanStatus.Pending.ToString(), response.Status);
        Assert.False(response.Applied);
        Assert.Equal(2, response.Subtasks.Count);
        Assert.Equal(2, response.Steps.Count);
        Assert.Equal(2, response.DefinitionOfDone.Count);

        await _aiPlanRepository.Received(1).AddAsync(
            Arg.Is<AiPlan>(plan =>
                plan.TaskId == _task.Id &&
                plan.ProjectId == _project.Id &&
                plan.CreatedBy == _userId &&
                plan.Status == AiPlanStatus.Pending),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldAutoApply_WhenSelfApprovalOn()
    {
        _project.SetApproveAiPlans(true);
        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(SamplePlanJson());

        var handler = BuildHandler();
        var response = await handler.Handle(
            new PlanTaskCommand(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        Assert.True(response.Applied);
        Assert.Equal(AiPlanStatus.Applied.ToString(), response.Status);
        Assert.Equal("Tests pass\nDocs updated", _task.DefinitionOfDone?.Replace("\r\n", "\n"));

        // Two subtasks created under the parent, inheriting sprint context.
        await _taskItemRepository.Received(2).AddAsync(
            Arg.Is<TaskItem>(subtask => subtask.ParentTaskId == _task.Id),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldPassWeightedKnowledge_IntoUserContext()
    {
        var highWeight = KnowledgeEntry.Create(_project.Id, "Deploy ADR", "Render + Vercel.", KnowledgeType.Adr);
        highWeight.SetWeight(0.9m);
        var lowWeight = KnowledgeEntry.Create(_project.Id, "Old pattern", "Legacy.", KnowledgeType.Pattern);
        lowWeight.SetWeight(0.2m);
        _knowledgeRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<KnowledgeEntry> { highWeight, lowWeight });

        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(SamplePlanJson());

        var handler = BuildHandler();
        await handler.Handle(
            new PlanTaskCommand(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        await _aiClient.Received(1).PlanTaskAsync(
            Arg.Any<string>(),
            Arg.Is<string>(context =>
                context.Contains("Deploy ADR") &&
                context.Contains("weight 0.9") &&
                context.Contains("Old pattern")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenAiClientReturnsNull()
    {
        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((string?)null);

        var handler = BuildHandler();

        await Assert.ThrowsAsync<AiPlanningUnavailableException>(() =>
            handler.Handle(new PlanTaskCommand(_workspaceId, _project.Id, _task.Id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrow_WhenAiReturnsEmptyPlan()
    {
        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(JsonSerializer.Serialize(new { summary = "empty" }));

        var handler = BuildHandler();

        await Assert.ThrowsAsync<AiPlanningUnavailableException>(() =>
            handler.Handle(new PlanTaskCommand(_workspaceId, _project.Id, _task.Id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldSupersedePreviousPendingPlans()
    {
        var previous = AiPlan.Create(
            _project.Id, _task.Id, _userId, _workspaceId, "old", "[]", "[]", "[]");
        _aiPlanRepository.GetPendingForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<AiPlan> { previous });
        _aiClient.PlanTaskAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(SamplePlanJson());

        var handler = BuildHandler();
        await handler.Handle(
            new PlanTaskCommand(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        Assert.Equal(AiPlanStatus.Superseded, previous.Status);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenTaskInOtherProject()
    {
        var foreignTask = TaskItem.Create(Guid.NewGuid(), "Foreign", null, TaskItemPriority.Low);
        _taskItemRepository.GetByIdAsync(foreignTask.Id, Arg.Any<CancellationToken>()).Returns(foreignTask);

        var handler = BuildHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new PlanTaskCommand(_workspaceId, _project.Id, foreignTask.Id), CancellationToken.None));
    }
}
