using System.Reflection;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Epics.Delete;
using DevFlow.Application.Features.Export;
using DevFlow.Application.Features.Import;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Security;

/// <summary>
/// Security guard rails: destructive / data-sensitivity operations must
/// require at least WorkspaceRole.Admin. A plain Member must be rejected
/// by the authorization behavior before the handler can run.
/// </summary>
public class RbacAuthorizationTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();

    public RbacAuthorizationTests()
    {
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    private WorkspaceAuthorizationBehavior<TRequest, string> CreateBehavior<TRequest>()
        where TRequest : notnull
        => new(_workspaceRepository, _userContext);

    // ── Helpers ────────────────────────────────────────────────────────────

    private static WorkspaceRole RequiredRole<TRequest>() where TRequest : class
    {
        return typeof(TRequest)
            .GetCustomAttributes(typeof(RequireWorkspaceRoleAttribute), inherit: false)
            .Cast<RequireWorkspaceRoleAttribute>()
            .First().MinimumRole;
    }

    private static async Task<string> RunBehaviorAsync<TRequest>(
        WorkspaceAuthorizationBehavior<TRequest, string> behavior,
        TRequest request)
        where TRequest : notnull
    {
        return await behavior.Handle(
            request,
            (_) => Task.FromResult("handled"),
            CancellationToken.None);
    }

    [Theory]
    [InlineData(typeof(ImportProjectBackupCommand))]
    [InlineData(typeof(ExportProjectBackupQuery))]
    [InlineData(typeof(DeleteEpicCommand))]
    public void DestructiveOperations_ShouldRequireAtLeastAdmin(Type requestType)
    {
        var required = requestType
            .GetCustomAttributes(typeof(RequireWorkspaceRoleAttribute), inherit: false)
            .Cast<RequireWorkspaceRoleAttribute>()
            .First().MinimumRole;

        Assert.True(
            required >= WorkspaceRole.Admin,
            $"{requestType.Name} requires {required} — must be at least {WorkspaceRole.Admin}.");
    }

    // ── Import ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task ImportBackup_Member_ShouldBeRejected()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var behavior = CreateBehavior<ImportProjectBackupCommand>();
        var request = new ImportProjectBackupCommand(Guid.NewGuid(), Guid.NewGuid(), "{}");

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None));
    }

    [Fact]
    public async Task ImportBackup_Admin_ShouldBeAllowed()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var behavior = CreateBehavior<ImportProjectBackupCommand>();
        var request = new ImportProjectBackupCommand(Guid.NewGuid(), Guid.NewGuid(), "{}");

        var result = await behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }

    // ── Export backup ──────────────────────────────────────────────────────

    [Fact]
    public async Task ExportBackup_Member_ShouldBeRejected()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var behavior = CreateBehavior<ExportProjectBackupQuery>();
        var request = new ExportProjectBackupQuery(Guid.NewGuid(), Guid.NewGuid(), "json");

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None));
    }

    [Fact]
    public async Task ExportBackup_Admin_ShouldBeAllowed()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var behavior = CreateBehavior<ExportProjectBackupQuery>();
        var request = new ExportProjectBackupQuery(Guid.NewGuid(), Guid.NewGuid(), "json");

        var result = await behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }

    // ── Delete epic ────────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteEpic_Member_ShouldBeRejected()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var behavior = CreateBehavior<DeleteEpicCommand>();
        var request = new DeleteEpicCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<ForbiddenAccessException>(() =>
            behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None));
    }

    [Fact]
    public async Task DeleteEpic_Admin_ShouldBeAllowed()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var behavior = CreateBehavior<DeleteEpicCommand>();
        var request = new DeleteEpicCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var result = await behavior.Handle(request, (_) => Task.FromResult("handled"), CancellationToken.None);

        Assert.Equal("handled", result);
    }
}
