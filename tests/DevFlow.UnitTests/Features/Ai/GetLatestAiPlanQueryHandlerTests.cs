using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

public class GetLatestAiPlanQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IAiPlanRepository _aiPlanRepository = Substitute.For<IAiPlanRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public GetLatestAiPlanQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Fix CLS", null, TaskItemPriority.High);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    private GetLatestAiPlanQueryHandler BuildHandler() => new(
        _projectRepository,
        _taskItemRepository,
        _aiPlanRepository);

    [Fact]
    public async Task Handle_ShouldReadTitles_FromPascalCasePersistedJson()
    {
        // PlanTaskCommandHandler persists subtasks by serializing an anonymous
        // type, so the stored keys are PascalCase ("Title"). A case-sensitive
        // read leaves every title empty and the panel renders blank cards.
        var subtasksJson = JsonSerializer.Serialize(new[]
        {
            new { Title = "Audit triggers", Description = (string?)"Measure CLS", Priority = "High" },
            new { Title = "Add constraints", Description = (string?)null, Priority = "Medium" },
        });
        var plan = AiPlan.Create(
            _project.Id,
            _task.Id,
            Guid.NewGuid(),
            _workspaceId,
            "Reserve dimensions",
            JsonSerializer.Serialize(new[] { "step one" }),
            subtasksJson,
            JsonSerializer.Serialize(new[] { "CLS under 0.1" }));

        _aiPlanRepository.GetLatestForTaskAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(plan);

        var response = await BuildHandler().Handle(
            new GetLatestAiPlanQuery(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        Assert.NotNull(response);
        Assert.Equal("Reserve dimensions", response.Summary);
        Assert.Equal(new[] { "step one" }, response.Steps);
        Assert.Equal(new[] { "CLS under 0.1" }, response.DefinitionOfDone);
        Assert.Equal(2, response.Subtasks.Count);
        Assert.Equal("Audit triggers", response.Subtasks[0].Title);
        Assert.Equal("Measure CLS", response.Subtasks[0].Description);
        Assert.Equal("High", response.Subtasks[0].Priority);
        Assert.Equal("Add constraints", response.Subtasks[1].Title);
        Assert.Null(response.Subtasks[1].Description);
    }

    [Fact]
    public async Task Handle_ShouldReturnNull_WhenNoPlanExists()
    {
        _aiPlanRepository.GetLatestForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns((AiPlan?)null);

        var response = await BuildHandler().Handle(
            new GetLatestAiPlanQuery(_workspaceId, _project.Id, _task.Id),
            CancellationToken.None);

        Assert.Null(response);
    }
}
