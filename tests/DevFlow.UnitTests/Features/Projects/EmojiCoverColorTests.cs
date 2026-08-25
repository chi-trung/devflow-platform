using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Projects.Create;
using DevFlow.Application.Features.Projects.List;
using DevFlow.Application.Features.Projects.Update;
using DevFlow.Application.Features.Workspaces.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Projects;

/// <summary>
/// Sprint 32 — B32.1: workspace emoji + project emoji/coverColor round-trip.
/// Verifies the fields are stored on create, exposed on read, and
/// cleared/overwritten on update, with missing values defaulting to null.
/// </summary>
public class EmojiCoverColorTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly Guid _workspaceId = Guid.NewGuid();

    public EmojiCoverColorTests()
    {
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    [Fact]
    public async Task CreateProject_WithEmojiAndCover_RoundTripsThroughResponse()
    {
        var handler = new CreateProjectCommandHandler(_projectRepository, _unitOfWork);

        var projectId = await handler.Handle(
            new CreateProjectCommand(_workspaceId, "Design", "DSN", "Design system", "🎨", "violet"),
            CancellationToken.None);

        await _projectRepository.Received(1).AddAsync(
            Arg.Any<Project>(), Arg.Any<CancellationToken>());
        Assert.NotEqual(Guid.Empty, projectId);

        var captured = _projectRepository.ReceivedCalls()
            .First(call => call.GetMethodInfo().Name == nameof(IProjectRepository.AddAsync))
            .GetArguments()[0] as Project;

        Assert.NotNull(captured);
        Assert.Equal("🎨", captured!.Emoji);
        Assert.Equal("violet", captured.CoverColor);
    }

    [Fact]
    public async Task CreateProject_WithoutEmojiAndCover_DefaultsToNull()
    {
        var handler = new CreateProjectCommandHandler(_projectRepository, _unitOfWork);

        await handler.Handle(
            new CreateProjectCommand(_workspaceId, "Plain", "PLN", null),
            CancellationToken.None);

        var captured = _projectRepository.ReceivedCalls()
            .First(call => call.GetMethodInfo().Name == nameof(IProjectRepository.AddAsync))
            .GetArguments()[0] as Project;

        Assert.NotNull(captured);
        Assert.Null(captured!.Emoji);
        Assert.Null(captured.CoverColor);
    }

    [Fact]
    public async Task UpdateProject_WithEmojiAndCover_PersistsAndRoundTrips()
    {
        var project = Project.Create(_workspaceId, "DevFlow Core", "DEV", "Core platform");
        _projectRepository.GetByIdAsync(project.Id, Arg.Any<CancellationToken>()).Returns(project);

        var handler = new UpdateProjectCommandHandler(_projectRepository, _unitOfWork);
        await handler.Handle(
            new UpdateProjectCommand(_workspaceId, project.Id, "DevFlow Core", "Core platform", "🚀", "teal"),
            CancellationToken.None);

        Assert.Equal("🚀", project.Emoji);
        Assert.Equal("teal", project.CoverColor);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateProject_EmojiAndCover_AreClearedByNullAndOverwritten()
    {
        var project = Project.Create(_workspaceId, "DevFlow Core", "DEV", "Core", "🔥", "red");
        _projectRepository.GetByIdAsync(project.Id, Arg.Any<CancellationToken>()).Returns(project);

        var handler = new UpdateProjectCommandHandler(_projectRepository, _unitOfWork);

        // Clear emoji, overwrite coverColor.
        await handler.Handle(
            new UpdateProjectCommand(_workspaceId, project.Id, "DevFlow Core", "Core", null, "blue"),
            CancellationToken.None);

        Assert.Null(project.Emoji);
        Assert.Equal("blue", project.CoverColor);

        // Overwrite emoji with a new value, clear coverColor.
        await handler.Handle(
            new UpdateProjectCommand(_workspaceId, project.Id, "DevFlow Core", "Core", "📦", null),
            CancellationToken.None);

        Assert.Equal("📦", project.Emoji);
        Assert.Null(project.CoverColor);
        await _unitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ListProjects_ExposesEmojiAndCoverInResponse()
    {
        var project = Project.Create(_workspaceId, "DevFlow Core", "DEV", "Core", "🎯", "indigo");
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { project });

        var handler = new ListProjectsQueryHandler(_projectRepository);

        var result = await handler.Handle(new ListProjectsQuery(_workspaceId), CancellationToken.None);

        var response = Assert.Single(result.Items);
        Assert.Equal("🎯", response.Emoji);
        Assert.Equal("indigo", response.CoverColor);
    }

    [Fact]
    public async Task UpdateWorkspace_WithEmoji_PersistsAndRoundTrips()
    {
        var workspace = Workspace.Create("Acme", "acme", "Old description");
        _workspaceRepository.GetByIdAsync(workspace.Id, Arg.Any<CancellationToken>()).Returns(workspace);
        _workspaceRepository.GetMemberRoleAsync(workspace.Id, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var handler = new UpdateWorkspaceCommandHandler(_workspaceRepository, _userContext, _unitOfWork);
        var result = await handler.Handle(
            new UpdateWorkspaceCommand(workspace.Id, "Acme", "New description", "🏢"),
            CancellationToken.None);

        Assert.Equal("🏢", workspace.Emoji);
        Assert.Equal("🏢", result.Emoji);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateWorkspace_EmojiClearedByNull_WhenNotProvided()
    {
        var workspace = Workspace.Create("Acme", "acme", "Old", "🏢");
        _workspaceRepository.GetByIdAsync(workspace.Id, Arg.Any<CancellationToken>()).Returns(workspace);
        _workspaceRepository.GetMemberRoleAsync(workspace.Id, Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Admin);

        var handler = new UpdateWorkspaceCommandHandler(_workspaceRepository, _userContext, _unitOfWork);
        await handler.Handle(
            new UpdateWorkspaceCommand(workspace.Id, "Acme", "Old", null),
            CancellationToken.None);

        Assert.Null(workspace.Emoji);
    }
}
