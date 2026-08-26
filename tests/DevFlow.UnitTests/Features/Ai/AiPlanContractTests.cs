using DevFlow.Application.Features.Ai;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.UnitTests.Features.Ai;

public class AiPlanContractTests
{
    [Fact]
    public void Parse_ShouldHandleFullContract()
    {
        var json = """
            {
              "summary": "Plan it",
              "steps": ["one", "two"],
              "subtasks": [
                { "title": "A", "description": "desc", "priority": "High" }
              ],
              "definitionOfDone": ["tests pass"]
            }
            """;

        var contract = AiPlanContract.Parse(json);

        Assert.Equal("Plan it", contract.Summary);
        Assert.Equal(2, contract.Steps.Count);
        Assert.Single(contract.Subtasks);
        Assert.Equal("A", contract.Subtasks[0].Title);
        Assert.Equal("High", contract.Subtasks[0].Priority);
        Assert.Single(contract.DefinitionOfDone);
    }

    [Fact]
    public void Parse_ShouldReturnEmpty_OnMalformedJson()
    {
        var contract = AiPlanContract.Parse("not json at all");

        Assert.NotNull(contract);
        Assert.Empty(contract.Steps);
        Assert.Empty(contract.Subtasks);
        Assert.Empty(contract.DefinitionOfDone);
    }

    [Fact]
    public void Parse_ShouldBeCaseInsensitive_OnPropertyNames()
    {
        var json = """{ "Summary": "x", "Steps": ["s"], "Subtasks": [], "DefinitionOfDone": ["d"] }""";

        var contract = AiPlanContract.Parse(json);

        Assert.Equal("x", contract.Summary);
        Assert.Single(contract.Steps);
        Assert.Single(contract.DefinitionOfDone);
    }
}

public class AiPlanEntityTests
{
    [Fact]
    public void Create_ShouldStartAsPending()
    {
        var plan = AiPlan.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, "sum", "[]", "[]", "[]");

        Assert.Equal(AiPlanStatus.Pending, plan.Status);
        Assert.Equal("sum", plan.Summary);
    }

    [Fact]
    public void MarkApplied_ShouldTransitionStatus()
    {
        var plan = AiPlan.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, "[]", "[]", "[]");

        plan.MarkApplied();

        Assert.Equal(AiPlanStatus.Applied, plan.Status);
    }

    [Fact]
    public void MarkSuperseded_ShouldTransitionStatus()
    {
        var plan = AiPlan.Create(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, null, "[]", "[]", "[]");

        plan.MarkSuperseded();

        Assert.Equal(AiPlanStatus.Superseded, plan.Status);
    }
}
