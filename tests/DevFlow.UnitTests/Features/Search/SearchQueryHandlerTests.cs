using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Search;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Search;

public class SearchQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public SearchQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { _project });
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyResult_WhenKeywordIsEmpty()
    {
        var handler = CreateHandler();
        var query = new SearchQuery(_workspaceId, "");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Empty(result.Tasks);
        Assert.Empty(result.Projects);
        Assert.Empty(result.Epics);
        Assert.Empty(result.Labels);
        Assert.Empty(result.Users);
        Assert.Empty(result.Comments);
    }

    [Fact]
    public async Task Handle_ShouldSearchTasks_ByTitle()
    {
        var task = Domain.Entities.TaskItem.Create(_project.Id, "Fix login bug", null, TaskItemPriority.High);
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = CreateHandler();
        var query = new SearchQuery(_workspaceId, "login");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Tasks);
        Assert.Equal("Fix login bug", result.Tasks[0].Title);
    }

    [Fact]
    public async Task Handle_ShouldSearchEpics_ByName()
    {
        var epic = Epic.Create(_project.Id, "Mobile App v2", "Description");
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { epic });

        var handler = CreateHandler();
        var query = new SearchQuery(_workspaceId, "mobile");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Epics);
        Assert.Equal("Mobile App v2", result.Epics[0].Name);
    }

    [Fact]
    public async Task Handle_ShouldSearchLabels_ByName()
    {
        var label = Label.Create(_project.Id, "Bug", "#ff0000");
        _labelRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { label });

        var handler = CreateHandler();
        var query = new SearchQuery(_workspaceId, "bug");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Labels);
        Assert.Equal("Bug", result.Labels[0].Name);
    }

    [Fact]
    public async Task Handle_ShouldSearchUsers_ByDisplayName()
    {
        var userId = Guid.NewGuid();
        var members = new[] { (UserId: userId, Email: "test@test.com", Username: "testuser", DisplayName: "Test Member", Role: WorkspaceRole.Member) };
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(members);

        var handler = CreateHandler();
        var query = new SearchQuery(_workspaceId, "member");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Users);
        Assert.Equal("Test Member", result.Users[0].DisplayName);
    }

    private SearchQueryHandler CreateHandler()
    {
        return new SearchQueryHandler(
            _projectRepository,
            _taskItemRepository,
            _epicRepository,
            _labelRepository,
            _commentRepository,
            _workspaceRepository);
    }
}
