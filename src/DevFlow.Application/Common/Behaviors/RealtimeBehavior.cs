using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a project- or workspace-scoped command succeeds, notifies realtime
/// subscribers so open boards and lists can refresh.
/// </summary>
public sealed class RealtimeBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IRealtimeNotifier notifier;

    public RealtimeBehavior(IRealtimeNotifier notifier)
    {
        this.notifier = notifier;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var response = await next();

        // A command may implement both (e.g. creating a project mutates the
        // workspace it belongs to), so check each independently.
        if (request is IProjectEvent projectEvent)
        {
            await notifier.NotifyProjectAsync(
                projectEvent.ProjectId,
                typeof(TRequest).Name,
                cancellationToken);
        }

        if (request is IWorkspaceEvent workspaceEvent)
        {
            await notifier.NotifyWorkspaceAsync(
                workspaceEvent.WorkspaceId,
                typeof(TRequest).Name,
                cancellationToken);
        }

        return response;
    }
}
