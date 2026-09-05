using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Common.Behaviors;

public class WorkspaceAuthorizationBehaviorTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();

    private const string PipelineResult = "handled";

    public WorkspaceAuthorizationBehaviorTests()
    {
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    private WorkspaceAuthorizationBehavior<TRequest, string> CreateBehavior<TRequest>()
        where TRequest : notnull
        => new(_workspaceRepository, _userContext);

    [Fact]
    public async Task Handle_ShouldThrowForbidden_WhenUserIsNotAMember()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);

        var behavior = CreateBehavior<AdminOnlyRequest>();
        var request = new AdminOnlyRequest(Guid.NewGuid());

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, (_) => Task.FromResult(PipelineResult), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowForbidden_WhenRoleIsBelowMinimum()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var behavior = CreateBehavior<AdminOnlyRequest>();
        var request = new AdminOnlyRequest(Guid.NewGuid());

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, (_) => Task.FromResult(PipelineResult), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldAllowRoleEqualToMinimum()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var behavior = CreateBehavior<AdminOnlyRequest>();
        var request = new AdminOnlyRequest(Guid.NewGuid());

        var result = await behavior.Handle(request, (_) => Task.FromResult(PipelineResult), CancellationToken.None);

        Assert.Equal(PipelineResult, result);
    }

    [Fact]
    public async Task Handle_ShouldAllowOwnerWhenAdminIsRequired()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Owner);

        var behavior = CreateBehavior<AdminOnlyRequest>();
        var request = new AdminOnlyRequest(Guid.NewGuid());

        var result = await behavior.Handle(request, (_) => Task.FromResult(PipelineResult), CancellationToken.None);

        Assert.Equal(PipelineResult, result);
    }

    [Fact]
    public async Task Handle_ShouldAllowAnyMemberByDefault()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var behavior = CreateBehavior<AnyMemberRequest>();
        var request = new AnyMemberRequest(Guid.NewGuid());

        var result = await behavior.Handle(request, (_) => Task.FromResult(PipelineResult), CancellationToken.None);

        Assert.Equal(PipelineResult, result);
    }

    [Fact]
    public async Task Handle_ShouldPassThroughRequestsOutsideWorkspaces()
    {
        var behavior = CreateBehavior<PlainRequest>();

        var result = await behavior.Handle(
            new PlainRequest(),
            (_) => Task.FromResult(PipelineResult),
            CancellationToken.None);

        Assert.Equal(PipelineResult, result);
    }

    [RequireWorkspaceRole(WorkspaceRole.Admin)]
    public sealed record AdminOnlyRequest(Guid WorkspaceId) : IRequest<string>, IWorkspaceRequest;

    public sealed record AnyMemberRequest(Guid WorkspaceId) : IRequest<string>, IWorkspaceRequest;

    public sealed record PlainRequest : IRequest<string>;
}
