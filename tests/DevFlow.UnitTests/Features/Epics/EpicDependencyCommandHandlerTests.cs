using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Epics.Dependencies;
using DevFlow.Domain.Entities;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Epics;

public class EpicDependencyCommandHandlerTests
{
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly IEpicDependencyRepository _dependencyRepository = Substitute.For<IEpicDependencyRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Epic _epic;
    private readonly Epic _blocker;

    public EpicDependencyCommandHandlerTests()
    {
        _epic = Epic.Create(_projectId, "Portal", null);
        _blocker = Epic.Create(_projectId, "Auth", null);
        _epicRepository.GetByIdAsync(_epic.Id, Arg.Any<CancellationToken>())
            .Returns(_epic);
        _epicRepository.GetByIdAsync(_blocker.Id, Arg.Any<CancellationToken>())
            .Returns(_blocker);
    }

    // ── Add ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Add_ShouldCreateDependency_WhenBothEpicsInSameProject()
    {
        var handler = new AddEpicDependencyCommandHandler(_epicRepository, _dependencyRepository, _unitOfWork);

        await handler.Handle(
            new AddEpicDependencyCommand(_workspaceId, _projectId, _epic.Id, _blocker.Id),
            CancellationToken.None);

        await _dependencyRepository.Received(1).AddAsync(
            Arg.Is<EpicDependency>(d => d.EpicId == _epic.Id && d.BlockedById == _blocker.Id),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Add_ShouldThrowNotFound_WhenEpicBelongsToDifferentProject()
    {
        var foreignProject = Epic.Create(Guid.NewGuid(), "Foreign", null);
        _epicRepository.GetByIdAsync(_epic.Id, Arg.Any<CancellationToken>())
            .Returns(foreignProject);

        var handler = new AddEpicDependencyCommandHandler(_epicRepository, _dependencyRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(
                new AddEpicDependencyCommand(_workspaceId, _projectId, _epic.Id, _blocker.Id),
                CancellationToken.None));

        await _dependencyRepository.DidNotReceive().AddAsync(Arg.Any<EpicDependency>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Add_ShouldThrowNotFound_WhenBlockerBelongsToDifferentProject()
    {
        var foreignBlocker = Epic.Create(Guid.NewGuid(), "Foreign", null);
        _epicRepository.GetByIdAsync(_blocker.Id, Arg.Any<CancellationToken>())
            .Returns(foreignBlocker);

        var handler = new AddEpicDependencyCommandHandler(_epicRepository, _dependencyRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(
                new AddEpicDependencyCommand(_workspaceId, _projectId, _epic.Id, _blocker.Id),
                CancellationToken.None));
    }

    // ── Remove ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Remove_ShouldRemoveDependency_WhenEpicExists()
    {
        var handler = new RemoveEpicDependencyCommandHandler(_epicRepository, _dependencyRepository, _unitOfWork);

        await handler.Handle(
            new RemoveEpicDependencyCommand(_workspaceId, _projectId, _epic.Id, _blocker.Id),
            CancellationToken.None);

        await _dependencyRepository.Received(1).RemoveAsync(
            _epic.Id, _blocker.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── List ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task List_ShouldReturnDependencies_ForEpic()
    {
        var dep1 = EpicDependency.Create(_epic.Id, _blocker.Id);
        var dep2 = EpicDependency.Create(_epic.Id, Guid.NewGuid());
        _dependencyRepository.GetForEpicAsync(_epic.Id, Arg.Any<CancellationToken>())
            .Returns(new List<EpicDependency> { dep1, dep2 });

        var handler = new ListEpicDependenciesQueryHandler(_epicRepository, _dependencyRepository);

        var result = await handler.Handle(
            new ListEpicDependenciesQuery(_workspaceId, _projectId, _epic.Id),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.BlockedByEpicId == _blocker.Id);
    }

    [Fact]
    public async Task List_ShouldThrowNotFound_WhenEpicMissing()
    {
        _epicRepository.GetByIdAsync(_epic.Id, Arg.Any<CancellationToken>())
            .Returns((Epic?)null);

        var handler = new ListEpicDependenciesQueryHandler(_epicRepository, _dependencyRepository);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(
                new ListEpicDependenciesQuery(_workspaceId, _projectId, _epic.Id),
                CancellationToken.None));
    }
}
