namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Implemented by commands that mutate state inside a workspace; after the
/// handler succeeds, clients in the workspace's group are notified so lists
/// (workspace/project sidebars, dashboards) refresh without a manual reload.
/// Distinct from <see cref="IWorkspaceRequest"/>, which is an authorization
/// marker rather than a realtime signal.
/// </summary>
public interface IWorkspaceEvent
{
    Guid WorkspaceId { get; }
}
