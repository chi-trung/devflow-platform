namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Implemented by a command whose activity label cannot be known when the
/// command is built — the object it names is only loaded inside the handler.
/// A delete or a detach names a row that is already gone or already changed by
/// the time anyone reads the feed, so the title has to be captured before the
/// write. The handler sets this once it has loaded the entity;
/// <see cref="ActivityBehavior{TRequest,TResponse}"/> prefers it over
/// <see cref="IProjectEvent.ActivityLabel"/> whenever it is set.
/// </summary>
public interface IActivityLabelSink
{
    string? ResolvedActivityLabel { get; set; }
}
