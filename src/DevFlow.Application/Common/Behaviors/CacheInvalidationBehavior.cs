using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a project-scoped command succeeds, invalidates all cached data
/// for that project so the next read goes to the database and is fresh.
/// </summary>
public sealed class CacheInvalidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ICacheService _cache;

    public CacheInvalidationBehavior(ICacheService cache)
    {
        _cache = cache;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var response = await next();

        if (request is IProjectEvent projectEvent)
        {
            await _cache.RemoveByTagAsync($"project:{projectEvent.ProjectId}");
        }

        return response;
    }
}