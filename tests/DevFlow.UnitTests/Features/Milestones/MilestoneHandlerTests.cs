using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Milestones.Create;
using DevFlow.Application.Features.Milestones.Delete;
using DevFlow.Application.Features.Milestones.List;
using DevFlow.Application.Features.Milestones.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Milestones;

public class MilestoneHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IMilestoneRepository _milestoneRepository = Substitute.For<IMilestoneRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public MilestoneHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Create_ShouldPersistMilestone()
    {
        var handler = new CreateMilestoneCommandHandler(_projectRepository, _milestoneRepository, _unitOfWork);
        var command = new CreateMilestoneCommand(
            _workspaceId, _project.Id, "GA Release", "Public launch",
            DateTimeOffset.UtcNow.AddDays(60));

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.Id);
        await _milestoneRepository.Received(1).AddAsync(Arg.Any<Milestone>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectMissing()
    {
        var handler = new CreateMilestoneCommandHandler(_projectRepository, _milestoneRepository, _unitOfWork);
        var command = new CreateMilestoneCommand(
            _workspaceId, Guid.NewGuid(), "Ghost Milestone", null, null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldReturnMilestonesInTargetDateOrder()
    {
        var later = Milestone.Create(_project.Id, "Later", null, DateTimeOffset.UtcNow.AddDays(30));
        var sooner = Milestone.Create(_project.Id, "Sooner", null, DateTimeOffset.UtcNow.AddDays(5));
        _milestoneRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { sooner, later });

        var handler = new ListMilestonesQueryHandler(_projectRepository, _milestoneRepository);
        var result = await handler.Handle(new ListMilestonesQuery(_workspaceId, _project.Id), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal("Sooner", result[0].Name);
        Assert.Equal(MilestoneStatus.Planned.ToString(), result[0].Status);
    }

    [Fact]
    public async Task Update_ShouldThrowNotFound_WhenMilestoneInOtherProject()
    {
        var otherProjectId = Guid.NewGuid();
        var milestone = Milestone.Create(otherProjectId, "Other", null, null);
        _milestoneRepository.GetByIdAsync(milestone.Id, Arg.Any<CancellationToken>()).Returns(milestone);

        var handler = new UpdateMilestoneCommandHandler(_projectRepository, _milestoneRepository, _unitOfWork);
        var command = new UpdateMilestoneCommand(
            _workspaceId, _project.Id, milestone.Id, "Renamed", null, null, MilestoneStatus.Active);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ShouldApplyStatusChange()
    {
        var milestone = Milestone.Create(_project.Id, "Doomed", null, null);
        _milestoneRepository.GetByIdAsync(milestone.Id, Arg.Any<CancellationToken>()).Returns(milestone);

        var handler = new UpdateMilestoneCommandHandler(_projectRepository, _milestoneRepository, _unitOfWork);
        var command = new UpdateMilestoneCommand(
            _workspaceId, _project.Id, milestone.Id, "Renamed", null, null, MilestoneStatus.Active);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal(MilestoneStatus.Active, milestone.Status);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldRemoveMilestone()
    {
        var milestone = Milestone.Create(_project.Id, "Doomed", null, null);
        _milestoneRepository.GetByIdAsync(milestone.Id, Arg.Any<CancellationToken>()).Returns(milestone);

        var handler = new DeleteMilestoneCommandHandler(_projectRepository, _milestoneRepository, _unitOfWork);
        await handler.Handle(new DeleteMilestoneCommand(_workspaceId, _project.Id, milestone.Id), CancellationToken.None);

        await _milestoneRepository.Received(1).RemoveAsync(milestone, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
