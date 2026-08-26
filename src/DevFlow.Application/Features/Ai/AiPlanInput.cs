using DevFlow.Domain.Enums;

namespace DevFlow.Application.Features.Ai;

/// <summary>A single subtask suggested by the AI planner.</summary>
public sealed record AiPlanSubtask(
    string Title,
    string? Description,
    string Priority)
{
    /// <summary>Parses the priority string into the enum; defaults to Medium.</summary>
    public TaskItemPriority ToPriority() =>
        Enum.TryParse<TaskItemPriority>(Priority, ignoreCase: true, out var priority)
            ? priority
            : TaskItemPriority.Medium;
}

/// <summary>The parsed plan content (shared between the plan + apply commands).</summary>
public sealed record AiPlanInput(
    string? Summary,
    IReadOnlyList<string> Steps,
    IReadOnlyList<AiPlanSubtask> Subtasks,
    IReadOnlyList<string> DefinitionOfDone)
{
    public static readonly AiPlanInput Empty =
        new(null, Array.Empty<string>(), Array.Empty<AiPlanSubtask>(), Array.Empty<string>());
}
