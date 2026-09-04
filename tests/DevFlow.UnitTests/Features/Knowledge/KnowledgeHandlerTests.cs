using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Knowledge.Create;
using DevFlow.Application.Features.Knowledge.Delete;
using DevFlow.Application.Features.Knowledge.List;
using DevFlow.Application.Features.Knowledge.Supersede;
using DevFlow.Application.Features.Knowledge.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Knowledge;

public class KnowledgeHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IKnowledgeRepository _knowledgeRepository = Substitute.For<IKnowledgeRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public KnowledgeHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Create_ShouldPersistKnowledgeEntryAsDraft()
    {
        var handler = new CreateKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        var command = new CreateKnowledgeEntryCommand(
            _workspaceId, _project.Id, "How we deploy", "Render + Vercel pipeline.", KnowledgeType.Runbook, "devops");

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.Id);
        await _knowledgeRepository.Received(1).AddAsync(
            Arg.Is<KnowledgeEntry>(entry =>
                entry.Title == "How we deploy" &&
                entry.Type == KnowledgeType.Runbook &&
                entry.Status == KnowledgeStatus.Draft &&
                entry.Weight == 1m &&
                entry.TaskId == null),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectMissing()
    {
        var handler = new CreateKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        var command = new CreateKnowledgeEntryCommand(
            _workspaceId, Guid.NewGuid(), "Ghost", null, KnowledgeType.Adr, null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldReturnEntries()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "DB indexes", "Composite indexes.", KnowledgeType.Pattern, "perf");
        _knowledgeRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { entry });

        var handler = new ListKnowledgeEntriesQueryHandler(_projectRepository, _knowledgeRepository);
        var result = await handler.Handle(new ListKnowledgeEntriesQuery(_workspaceId, _project.Id), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("DB indexes", result[0].Title);
        Assert.Equal(KnowledgeType.Pattern.ToString(), result[0].Type);
        Assert.Equal(KnowledgeStatus.Draft.ToString(), result[0].Status);
    }

    [Fact]
    public async Task Update_ShouldThrowNotFound_WhenEntryInOtherProject()
    {
        var otherProjectId = Guid.NewGuid();
        var entry = KnowledgeEntry.Create(otherProjectId, "Other", null, KnowledgeType.Adr);
        _knowledgeRepository.GetByIdAsync(entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var handler = new UpdateKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        var command = new UpdateKnowledgeEntryCommand(
            _workspaceId, _project.Id, entry.Id, "Renamed", null, KnowledgeType.Adr, null, KnowledgeStatus.Accepted);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ShouldApplyDetailsAndStatus()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "Old", "Old body", KnowledgeType.Adr, "old");
        _knowledgeRepository.GetByIdAsync(entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var handler = new UpdateKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        var command = new UpdateKnowledgeEntryCommand(
            _workspaceId, _project.Id, entry.Id, "New title", "New body", KnowledgeType.Runbook, "new", KnowledgeStatus.Accepted);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal("New title", entry.Title);
        Assert.Equal("New body", entry.Body);
        Assert.Equal(KnowledgeType.Runbook, entry.Type);
        Assert.Equal(KnowledgeStatus.Accepted, entry.Status);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldRemoveEntry()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "Doomed", null, KnowledgeType.Adr);
        _knowledgeRepository.GetByIdAsync(entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var handler = new DeleteKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        await handler.Handle(new DeleteKnowledgeEntryCommand(_workspaceId, _project.Id, entry.Id), CancellationToken.None);

        await _knowledgeRepository.Received(1).RemoveAsync(entry, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Supersede_ShouldMarkOldEntryAsSuperseded_WithLowWeight()
    {
        var oldEntry = KnowledgeEntry.Create(_project.Id, "Old decision", "v1", KnowledgeType.Adr);
        var newEntry = KnowledgeEntry.Create(_project.Id, "New decision", "v2", KnowledgeType.Adr);
        _knowledgeRepository.GetByIdAsync(oldEntry.Id, Arg.Any<CancellationToken>()).Returns(oldEntry);
        _knowledgeRepository.GetByIdAsync(newEntry.Id, Arg.Any<CancellationToken>()).Returns(newEntry);

        var handler = new SupersedeKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        await handler.Handle(
            new SupersedeKnowledgeEntryCommand(_workspaceId, _project.Id, oldEntry.Id, newEntry.Id),
            CancellationToken.None);

        Assert.Equal(KnowledgeStatus.Superseded, oldEntry.Status);
        Assert.Equal(newEntry.Id, oldEntry.SupersededById);
        Assert.Equal(0.05m, oldEntry.Weight);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Supersede_ShouldThrowNotFound_WhenSupersedingEntryInOtherProject()
    {
        var oldEntry = KnowledgeEntry.Create(_project.Id, "Old decision", "v1", KnowledgeType.Adr);
        var otherProjectEntry = KnowledgeEntry.Create(Guid.NewGuid(), "Foreign", "v2", KnowledgeType.Adr);
        _knowledgeRepository.GetByIdAsync(oldEntry.Id, Arg.Any<CancellationToken>()).Returns(oldEntry);
        _knowledgeRepository.GetByIdAsync(otherProjectEntry.Id, Arg.Any<CancellationToken>()).Returns(otherProjectEntry);

        var handler = new SupersedeKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new SupersedeKnowledgeEntryCommand(_workspaceId, _project.Id, oldEntry.Id, otherProjectEntry.Id),
            CancellationToken.None));
    }

    [Fact]
    public void FlagDrift_ShouldSetNeedsReview_WithReasonAndTimestamp()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "Deploy runbook", null, KnowledgeType.Runbook);

        entry.FlagDrift("Task reopened.");

        Assert.True(entry.NeedsReview);
        Assert.Equal("Task reopened.", entry.DriftReason);
        Assert.NotNull(entry.DriftedAtUtc);
    }

    [Fact]
    public void FlagDrift_ShouldNotFlagRetiredEntries()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "Old decision", null, KnowledgeType.Adr);
        entry.MarkSupersededBy(Guid.NewGuid());

        entry.FlagDrift("Task reopened.");

        Assert.False(entry.NeedsReview);
    }

    [Fact]
    public async Task Update_ShouldClearDriftFlag()
    {
        var entry = KnowledgeEntry.Create(_project.Id, "Deploy runbook", null, KnowledgeType.Runbook);
        entry.FlagDrift("Task reopened.");
        _knowledgeRepository.GetByIdAsync(entry.Id, Arg.Any<CancellationToken>()).Returns(entry);

        var handler = new UpdateKnowledgeEntryCommandHandler(_projectRepository, _knowledgeRepository, _unitOfWork);
        await handler.Handle(
            new UpdateKnowledgeEntryCommand(_workspaceId, _project.Id, entry.Id, "Refreshed", null, KnowledgeType.Runbook, null, KnowledgeStatus.Accepted),
            CancellationToken.None);

        Assert.False(entry.NeedsReview);
        Assert.Null(entry.DriftReason);
        Assert.Null(entry.DriftedAtUtc);
    }
}
