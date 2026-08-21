using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Implemented by commands that mutate state inside a project; after the
/// handler succeeds, connected project clients are notified so they can
/// refresh their view.
/// </summary>
public interface IProjectEvent
{
    Guid ProjectId { get; }
}
