using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

public class CacheInvalidationBehaviorTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();

    [Fact]
    public async Task ShouldInvalidateProjectTag_WhenRequestImplementsIProjectEvent()
    {
        var behavior = new CacheInvalidationBehavior<CreateTaskItemCommand, TaskItemCreatedResponse>(_cache);
        var projectId = Guid.NewGuid();

        Task<TaskItemCreatedResponse> Next() => Task.FromResult(new TaskItemCreatedResponse(Guid.NewGuid()));

        var command = new CreateTaskItemCommand(
            Guid.NewGuid(), projectId, "Test", null, TaskItemPriority.Medium, null);

        await behavior.Handle(command, Next, CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{projectId}");
    }

    [Fact]
    public async Task ShouldNotInvalidate_WhenRequestIsNotIProjectEvent()
    {
        var behavior = new CacheInvalidationBehavior<string, string>(_cache);

        Task<string> Next() => Task.FromResult("ok");

        await behavior.Handle("ping", Next, CancellationToken.None);

        await _cache.DidNotReceive().RemoveByTagAsync(Arg.Any<string>());
    }
}