using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using StackExchange.Redis;

namespace DevFlow.Infrastructure.Caching;

public sealed class RedisCacheService(IConnectionMultiplexer connectionMultiplexer) : ICacheService
{
    private readonly IDatabase database = connectionMultiplexer.GetDatabase();
    private const string TagPrefix = "cache:tag:";

    public async Task<T?> GetAsync<T>(string key, CancellationToken cancellationToken = default)
    {
        var value = await database.StringGetAsync(key);
        if (!value.HasValue)
        {
            return default;
        }

        return JsonSerializer.Deserialize<T>(value!);
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
        await SetAsync(key, value, tags, ttl, cancellationToken);
        return value;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        var serialized = JsonSerializer.Serialize(value);
        // StackExchange.Redis 2.13 replaced the TimeSpan? overload with Expiration
        // (implicit conversion from TimeSpan; Default when no TTL was given).
        await database.StringSetAsync(
            key,
            serialized,
            expiration is { } ttl ? (Expiration)ttl : Expiration.Default);
    }

    public async Task SetAsync<T>(string key, T value, IEnumerable<string>? tags = null, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        var serialized = JsonSerializer.Serialize(value);
        await database.StringSetAsync(
            key,
            serialized,
            expiration is { } ttl ? (Expiration)ttl : Expiration.Default);

        if (tags is not null)
        {
            var tagTasks = tags.Select(tag =>
                database.SetAddAsync($"{TagPrefix}{tag}", key)).ToArray();
            await Task.WhenAll(tagTasks);
        }
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        await database.KeyDeleteAsync(key);
    }

    public async Task RemoveByTagAsync(string tag, CancellationToken cancellationToken = default)
    {
        var tagKey = $"{TagPrefix}{tag}";
        var keys = await database.SetMembersAsync(tagKey);

        if (keys.Length == 0) return;

        var keyTasks = new List<Task>();
        foreach (var k in keys)
        {
            var key = k.ToString();
            if (!string.IsNullOrEmpty(key))
            {
                keyTasks.Add(database.KeyDeleteAsync(key));
            }
        }
        await Task.WhenAll(keyTasks);

        await database.KeyDeleteAsync(tagKey);
    }
}
