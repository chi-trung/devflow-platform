using DevFlow.Infrastructure.Caching;
using Microsoft.Extensions.Caching.Memory;

namespace DevFlow.UnitTests.Features.Caching;

public class MemoryCacheServiceTests : IDisposable
{
    private readonly MemoryCache _memoryCache = new(new MemoryCacheOptions());
    private readonly MemoryCacheService _service;

    public MemoryCacheServiceTests()
    {
        _service = new MemoryCacheService(_memoryCache);
    }

    public void Dispose() => _memoryCache.Dispose();

    [Fact]
    public async Task GetOrSet_ShouldInvokeFactoryOnlyOnce_ForSameKey()
    {
        var calls = 0;

        var first = await _service.GetOrSetAsync("k", _ => { calls++; return Task.FromResult("v" + calls); }, TimeSpan.FromMinutes(1));
        var second = await _service.GetOrSetAsync("k", _ => { calls++; return Task.FromResult("v" + calls); }, TimeSpan.FromMinutes(1));

        Assert.Equal("v1", first);
        Assert.Equal("v1", second);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task GetOrSet_ShouldExpire_AfterTtl()
    {
        var calls = 0;
        Task<string> Factory(CancellationToken _) { calls++; return Task.FromResult("c" + calls); }

        Assert.Equal("c1", await _service.GetOrSetAsync("ttl", Factory, TimeSpan.FromMilliseconds(30)));
        await Task.Delay(150);
        Assert.Equal("c2", await _service.GetOrSetAsync("ttl", Factory, TimeSpan.FromMilliseconds(30)));
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task RemoveByTag_ShouldEvictAllKeysCarryingTheTag()
    {
        await _service.SetAsync("a", "1", ["project:p1"]);
        await _service.SetAsync("b", "2", ["project:p1", "other"]);
        await _service.SetAsync("c", "3", ["other"]);

        await _service.RemoveByTagAsync("project:p1");

        Assert.Null(await _service.GetAsync<string>("a"));
        Assert.Null(await _service.GetAsync<string>("b"));
        Assert.Equal("3", await _service.GetAsync<string>("c"));
    }

    [Fact]
    public async Task RemoveByTag_ShouldNotResurrectKeys_OnNextSet()
    {
        await _service.SetAsync("a", "1", ["t"]);
        await _service.RemoveByTagAsync("t");
        await _service.RemoveByTagAsync("t"); // second remove is a no-op

        await _service.SetAsync("a", "2", ["t"]);
        Assert.Equal("2", await _service.GetAsync<string>("a"));
        await _service.RemoveByTagAsync("t");
        Assert.Null(await _service.GetAsync<string>("a"));
    }

    [Fact]
    public async Task RemoveAsync_ShouldEvictKey()
    {
        await _service.SetAsync("a", "1", ["t"]);
        await _service.RemoveAsync("a");
        Assert.Null(await _service.GetAsync<string>("a"));

        // The tag no longer references the removed key; this must not throw.
        await _service.RemoveByTagAsync("t");
    }

    [Fact]
    public async Task GetOrSet_ShouldNotCacheNullFactoryResults()
    {
        var calls = 0;
        Task<string?> Factory(CancellationToken _) { calls++; return Task.FromResult<string?>(null); }

        Assert.Null(await _service.GetOrSetAsync<string?>("n", Factory, TimeSpan.FromMinutes(1)));
        Assert.Null(await _service.GetOrSetAsync<string?>("n", Factory, TimeSpan.FromMinutes(1)));
        Assert.Equal(2, calls);
    }
}
