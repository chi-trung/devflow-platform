namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Implemented by commands that mutate state inside a project; after the
/// handler succeeds, connected project clients are notified and an
/// activity-log entry is written.
/// </summary>
public interface IProjectEvent
{
    Guid ProjectId { get; }

    /// <summary>Task the activity relates to, when applicable.</summary>
    Guid? ActivityTaskId => null;

    /// <summary>Past-tense verb, e.g. "created task". Required for logging.</summary>
    string ActivityVerb => "";

    /// <summary>Human label of the affected object, e.g. the task title.</summary>
    string ActivityLabel => "";
}
