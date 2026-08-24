using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Projects.Archive;
using DevFlow.Application.Features.Projects.GetById;
using DevFlow.Application.Features.Projects.List;
using DevFlow.Application.Features.Projects.Restore;
using DevFlow.Application.Features.Projects.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Projects;

public class ProjectLifecycleHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public ProjectLifecycleHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", "Core platform");
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(_project);
        _projectRepository.GetByIdIncludingDeletedAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(_project);
    }

    [Fact]
    public async Task List_ShouldReturnAllWorkspaceProjects()
    {
        var archived = Project.Create(_workspaceId, "Legacy", "LEG", null);
        archived.Archive();

        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project, archived });

        var handler = new ListProjectsQueryHandler(_projectRepository);

        var result = await handler.Handle(new ListProjectsQuery(_workspaceId), CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(2, result.Items.Count);
        Assert.Contains(result.Items, project => project.Status == "Active");
        Assert.Contains(result.Items, project => project.Status == "Archived");
    }

    [Fact]
    public async Task GetById_ShouldThrowNotFound_WhenProjectBelongsToAnotherWorkspace()
    {
        var handler = new GetProjectByIdQueryHandler(_projectRepository);
        var query = new GetProjectByIdQuery(Guid.NewGuid(), _project.Id);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(query, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ShouldChangeDetails_AndPersist()
    {
        var handler = new UpdateProjectCommandHandler(_projectRepository, _unitOfWork);
        var command = new UpdateProjectCommand(_workspaceId, _project.Id, "DevFlow Platform", "Renamed");

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal("DevFlow Platform", _project.Name);
        Assert.Equal("Renamed", _project.Description);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Archive_ShouldMarkProjectArchived_AndPersist()
    {
        var handler = new ArchiveProjectCommandHandler(_projectRepository, _unitOfWork);
        var command = new ArchiveProjectCommand(_workspaceId, _project.Id);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal(ProjectStatus.Archived, _project.Status);
        Assert.NotNull(_project.DeletedAtUtc);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Archive_ShouldThrowNotFound_WhenProjectIsMissing()
    {
        var handler = new ArchiveProjectCommandHandler(_projectRepository, _unitOfWork);
        var command = new ArchiveProjectCommand(_workspaceId, Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Restore_ShouldReturnArchivedProjectToActive()
    {
        _project.Archive();
        Assert.Equal(ProjectStatus.Archived, _project.Status);
        Assert.NotNull(_project.DeletedAtUtc);

        var handler = new RestoreProjectCommandHandler(_projectRepository, _unitOfWork);
        var command = new RestoreProjectCommand(_workspaceId, _project.Id);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal(ProjectStatus.Active, _project.Status);
        Assert.Null(_project.DeletedAtUtc);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Restore_ShouldThrowNotFound_WhenProjectIsMissing()
    {
        var handler = new RestoreProjectCommandHandler(_projectRepository, _unitOfWork);
        var command = new RestoreProjectCommand(_workspaceId, Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
