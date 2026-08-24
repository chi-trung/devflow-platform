using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.Caching;

public sealed class NullCacheService : ICacheService
{
    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default) =>
        Task.FromResult<T?>(default);

    public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task SetAsync<T>(string key, T value, IEnumerable<string>? tags = null, TimeSpan? expiration = null, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<T> GetOrSetAsync<T>(
        string key, Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null, IEnumerable<string>? tags = null,
        CancellationToken cancellationToken = default) =>
        factory(cancellationToken);

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task RemoveByTagAsync(string tag, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
