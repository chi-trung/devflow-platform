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
        //
        // Hub fan-out is best-effort: fire-and-forget so a slow/dead SignalR
        // connection cannot pin the HTTP response (comment POSTs were hanging
        // here after the DB write already succeeded). Faults are observed.
        if (request is IProjectEvent projectEvent)
        {
            Observe(notifier.NotifyProjectAsync(
                projectEvent.ProjectId,
                typeof(TRequest).Name,
                CancellationToken.None));
        }

        if (request is IWorkspaceEvent workspaceEvent)
        {
            Observe(notifier.NotifyWorkspaceAsync(
                workspaceEvent.WorkspaceId,
                typeof(TRequest).Name,
                CancellationToken.None));
        }

        return response;
    }

    private static void Observe(Task task) =>
        _ = task.ContinueWith(
            static t => _ = t.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);
}
