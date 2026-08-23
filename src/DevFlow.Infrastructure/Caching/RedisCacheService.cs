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

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        var serialized = JsonSerializer.Serialize(value);
        await database.StringSetAsync(key, serialized, expiration);
    }

    public async Task SetAsync<T>(string key, T value, IEnumerable<string>? tags = null, TimeSpan? expiration = null, CancellationToken cancellationToken = default)
    {
        var serialized = JsonSerializer.Serialize(value);
        await database.StringSetAsync(key, serialized, expiration);

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
