using System.Collections.Concurrent;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Caching.Memory;

namespace DevFlow.Infrastructure.Caching;

/// <summary>
/// Process-local cache used when no Redis connection string is configured
/// (e.g. Render free tier). Behaviorally interchangeable with
/// <see cref="RedisCacheService"/>: same TTL semantics and tag-based
/// invalidation, so handlers stay correct whichever implementation DI
/// picks. Single-instance deployments make in-process the natural choice —
/// it skips the Redis round-trip and is ~free next to a DB hop.
///
/// Values are stored by reference (no serialization), which is safe for
/// the immutable record DTOs the handlers cache.
/// </summary>
public sealed class MemoryCacheService(IMemoryCache memoryCache) : ICacheService
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, byte>> tagIndex = new();

    public Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default) =>
        Task.FromResult(memoryCache.TryGetValue(key, out object? value) ? (T?)value : default);

    public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        Set(key, value, expiration);
        return Task.CompletedTask;
    }

    public Task SetAsync<T>(string key, T value, IEnumerable<string>? tags = null, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        Set(key, value, expiration);
        if (tags is not null)
        {
            foreach (var tag in tags)
            {
                tagIndex.GetOrAdd(tag, _ => new ConcurrentDictionary<string, byte>())[key] = 0;
            }
        }
        return Task.CompletedTask;
    }

    public async Task<T> GetOrSetAsync<T>(
        string key,
        Func<CancellationToken, Task<T>> factory,
        TimeSpan? ttl = null,
        IEnumerable<string>? tags = null,
        CancellationToken cancellationToken = default)
    {
        var cached = await GetAsync<T>(key, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var value = await factory(cancellationToken);
        if (value is not null)
        {
            await SetAsync(key, value, tags, ttl, cancellationToken);
        }
        return value;
    }

    public Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        memoryCache.Remove(key);
        foreach (var keys in tagIndex.Values)
        {
            keys.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }

    public Task RemoveByTagAsync(string tag, CancellationToken cancellationToken = default)
    {
        if (tagIndex.TryRemove(tag, out var keys))
        {
            foreach (var key in keys.Keys)
            {
                memoryCache.Remove(key);
            }
        }
        return Task.CompletedTask;
    }

    private void Set<T>(string key, T value, TimeSpan? expiration)
    {
        var options = new MemoryCacheEntryOptions();
        if (expiration is { } ttl)
        {
            options.AbsoluteExpirationRelativeToNow = ttl;
        }
        memoryCache.Set(key, value, options);
    }
}
