using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

/// <summary>
/// An AI-generated plan for a task: a summary, ordered steps, proposed subtasks,
/// and a Definition of Done checklist. The plan is persisted so it can be
/// reviewed, applied, or superseded by a later regeneration.
/// </summary>
public class AiPlan : BaseEntity, IAuditableEntity
{
    private AiPlan()
    {
    }

    private AiPlan(
        Guid projectId,
        Guid taskId,
        Guid createdBy,
        Guid? workspaceId,
        string? summary,
        string stepsJson,
        string subtasksJson,
        string definitionOfDoneJson)
    {
        ProjectId = projectId;
        TaskId = taskId;
        CreatedBy = createdBy;
        WorkspaceId = workspaceId;
        Summary = summary;
        StepsJson = stepsJson;
        SubtasksJson = subtasksJson;
        DefinitionOfDoneJson = definitionOfDoneJson;
        Status = AiPlanStatus.Pending;
    }

    public Guid ProjectId { get; private set; }

    /// <summary>The task the plan was generated for.</summary>
    public Guid TaskId { get; private set; }

    /// <summary>The user who triggered the plan generation.</summary>
    public Guid CreatedBy { get; private set; }

    /// <summary>Workspace scope, used for authorization.</summary>
    public Guid? WorkspaceId { get; private set; }

    public AiPlanStatus Status { get; private set; }

    /// <summary>Optional one-line summary of the plan.</summary>
    public string? Summary { get; private set; }

    /// <summary>Serialized JSON array of step strings.</summary>
    public string StepsJson { get; private set; } = "[]";

    /// <summary>Serialized JSON array of { title, description, priority } objects.</summary>
    public string SubtasksJson { get; private set; } = "[]";

    /// <summary>Serialized JSON array of DoD checklist strings.</summary>
    public string DefinitionOfDoneJson { get; private set; } = "[]";

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static AiPlan Create(
        Guid projectId,
        Guid taskId,
        Guid createdBy,
        Guid? workspaceId,
        string? summary,
        string stepsJson,
        string subtasksJson,
        string definitionOfDoneJson)
    {
        return new AiPlan(
            projectId,
            taskId,
            createdBy,
            workspaceId,
            summary,
            stepsJson,
            subtasksJson,
            definitionOfDoneJson);
    }

    /// <summary>Marks the plan as applied (subtasks created, DoD set).</summary>
    public void MarkApplied()
    {
        Status = AiPlanStatus.Applied;
    }

    /// <summary>Marks an older plan superseded by a regeneration.</summary>
    public void MarkSuperseded()
    {
        Status = AiPlanStatus.Superseded;
    }
}