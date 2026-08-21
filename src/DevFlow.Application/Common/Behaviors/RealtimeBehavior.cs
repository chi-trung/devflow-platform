using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a project-scoped command succeeds, notifies realtime subscribers
/// so open boards can refresh.
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

        if (request is IProjectEvent projectEvent)
        {
            await notifier.NotifyProjectAsync(
                projectEvent.ProjectId,
                typeof(TRequest).Name,
                cancellationToken);
        }

        return response;
    }
}
