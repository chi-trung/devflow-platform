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

    [Fact]
    public void Parse_ShouldSalvageTitle_FromAliasKeys()
    {
        // Models drift from the contract's "title" key; without alias handling
        // the title silently becomes empty and AiPlanApplier drops the subtask.
        var json = """
            {
              "subtasks": [
                { "name": "From name key" },
                { "task": "From task key", "priority": "Critical" },
                { "label": "From label key", "details": "salvaged description" }
              ]
            }
            """;

        var contract = AiPlanContract.Parse(json);

        Assert.Equal(3, contract.Subtasks.Count);
        Assert.Equal("From name key", contract.Subtasks[0].Title);
        Assert.Equal("Medium", contract.Subtasks[0].Priority);
        Assert.Equal("From task key", contract.Subtasks[1].Title);
        Assert.Equal("Critical", contract.Subtasks[1].Priority);
        Assert.Equal("From label key", contract.Subtasks[2].Title);
        Assert.Equal("salvaged description", contract.Subtasks[2].Description);
    }

    [Fact]
    public void Parse_ShouldAcceptPlainStringSubtasks()
    {
        var json = """{ "subtasks": ["first job", "  ", 42, "third job"] }""";

        var contract = AiPlanContract.Parse(json);

        Assert.Equal(2, contract.Subtasks.Count);
        Assert.Equal("first job", contract.Subtasks[0].Title);
        Assert.Equal("third job", contract.Subtasks[1].Title);
        Assert.Equal("Medium", contract.Subtasks[1].Priority);
    }

    [Fact]
    public void Parse_ShouldDropSubtasks_WithNoUsableTitle()
    {
        var json = """
            {
              "subtasks": [
                { "title": "   " },
                { "description": "no title anywhere" },
                { "title": "Keep me" }
              ]
            }
            """;

        var contract = AiPlanContract.Parse(json);

        Assert.Single(contract.Subtasks);
        Assert.Equal("Keep me", contract.Subtasks[0].Title);
    }

    [Fact]
    public void Parse_ShouldTrimTitles()
    {
        var json = """{ "subtasks": [ { "title": "  padded  " } ] }""";

        var contract = AiPlanContract.Parse(json);

        Assert.Equal("padded", contract.Subtasks[0].Title);
    }

    [Fact]
    public void Parse_ShouldReturnEmpty_OnNonObjectRoot()
    {
        var contract = AiPlanContract.Parse("""["not", "an", "object"]""");

        Assert.NotNull(contract);
        Assert.Empty(contract.Subtasks);
        Assert.Empty(contract.Steps);
    }

    [Fact]
    public void Parse_ShouldSalvageSteps_FromObjectItems()
    {
        var json = """{ "steps": [ { "text": "do the thing" }, "plain step", { "nested": { "deep": true } } ] }""";

        var contract = AiPlanContract.Parse(json);

        Assert.Equal(2, contract.Steps.Count);
        Assert.Equal("do the thing", contract.Steps[0]);
        Assert.Equal("plain step", contract.Steps[1]);
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
