namespace DevFlow.Domain.Enums;

/// <summary>Lifecycle of an AI-generated plan for a task.</summary>
public enum AiPlanStatus
{
    /// <summary>Created by the planner, awaiting the user's review or apply.</summary>
    Pending = 0,

    /// <summary>Applied — subtasks were created and the parent task's DoD was set.</summary>
    Applied = 1,

    /// <summary>Superseded by a newer plan (the user regenerated).</summary>
    Superseded = 2,
}