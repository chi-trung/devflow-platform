namespace DevFlow.Application.Common.Exceptions;

/// <summary>
/// Thrown when an action violates the entity hierarchy (e.g. creating a subtask
/// under another subtask). Carries structured data so the caller can classify
/// the error and surface a recovery hint instead of a generic failure message.
/// </summary>
public sealed class InvalidHierarchyException : Exception
{
    /// <summary>The id of the parent entity that caused the violation.</summary>
    public Guid ParentId { get; }

    /// <summary>The actual entity type of the parent (e.g. "Subtask").</summary>
    public string ActualParentType { get; }

    /// <summary>The entity type that was required (e.g. "Task").</summary>
    public string RequiredParentType { get; }

    /// <summary>
    /// A human-readable hint the caller can surface to guide the AI toward
    /// a valid recovery action.
    /// </summary>
    public string RecoveryHint { get; }

    public InvalidHierarchyException(
        Guid parentId,
        string actualParentType,
        string requiredParentType,
        string message,
        string recoveryHint)
        : base(message)
    {
        ParentId = parentId;
        ActualParentType = actualParentType;
        RequiredParentType = requiredParentType;
        RecoveryHint = recoveryHint;
    }
}