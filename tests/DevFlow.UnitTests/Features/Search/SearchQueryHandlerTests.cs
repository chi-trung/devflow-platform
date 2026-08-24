using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Search;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Search;

public class SearchQueryHandlerTests
{
    private readonly ISearchRepository _searchRepository = Substitute.For<ISearchRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();

    [Fact]
    public async Task Handle_ShouldReturnEmptyResult_WhenKeywordIsEmpty()
    {
        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Empty(result.Tasks);
        Assert.Empty(result.Projects);
        Assert.Empty(result.Epics);
        Assert.Empty(result.Labels);
        Assert.Empty(result.Users);
        Assert.Empty(result.Comments);
        Assert.Equal(0, result.Pagination.TotalTasks);
    }

    [Fact]
    public async Task Handle_ShouldSearchTasks_ByTitle()
    {
        _searchRepository.SearchTasksAsync(
                _workspaceId,
                Arg.Any<string>(),
                Arg.Any<TaskItemSearchFilters>(),
                Arg.Any<int>(),
                Arg.Any<int>(),
                Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<TaskItemSearchRow>([
                new TaskItemSearchRow(Guid.NewGuid(), "Fix login bug", "Backlog", Guid.NewGuid(), "DEV")
            ], 1));
        _searchRepository.SearchProjectsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchEpicsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchLabelsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchCommentsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<CommentSearchRow>([], 0));
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "login");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Tasks);
        Assert.Equal("Fix login bug", result.Tasks[0].Title);
        Assert.Equal("DEV", result.Tasks[0].ProjectKey);
        Assert.Equal(1, result.Pagination.TotalTasks);
    }

    [Fact]
    public async Task Handle_ShouldSearchUsers_ByDisplayName()
    {
        _searchRepository.SearchTasksAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<TaskItemSearchFilters>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<TaskItemSearchRow>([], 0));
        _searchRepository.SearchProjectsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchEpicsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchLabelsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchCommentsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<CommentSearchRow>([], 0));
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { (UserId: Guid.NewGuid(), Email: "test@test.com", Username: "testuser", DisplayName: "Test Member", Role: WorkspaceRole.Member) });

        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "member");

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Users);
        Assert.Equal("Test Member", result.Users[0].DisplayName);
        Assert.Equal(1, result.Pagination.TotalUsers);
    }

    [Fact]
    public async Task Handle_ShouldReturnPaginationMetadata_WithPageAndPageSize()
    {
        _searchRepository.SearchTasksAsync(
                _workspaceId,
                Arg.Any<string>(),
                Arg.Any<TaskItemSearchFilters>(),
                0, 10, Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<TaskItemSearchRow>([
                new TaskItemSearchRow(Guid.NewGuid(), "task 1", "Backlog", Guid.NewGuid(), "DEV"),
                new TaskItemSearchRow(Guid.NewGuid(), "task 2", "Backlog", Guid.NewGuid(), "DEV")
            ], 25));
        _searchRepository.SearchProjectsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchEpicsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchLabelsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchCommentsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<CommentSearchRow>([], 0));
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "task", Page: 1, PageSize: 10);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Equal(2, result.Tasks.Count);
        Assert.Equal(25, result.Pagination.TotalTasks);
        Assert.Equal(1, result.Pagination.Page);
        Assert.Equal(10, result.Pagination.PageSize);
    }

    [Fact]
    public async Task Handle_ShouldNotFilterByKeyword_WhenKeywordPassedToRepository()
    {
        _searchRepository.SearchTasksAsync(
                _workspaceId,
                "login",
                Arg.Any<TaskItemSearchFilters>(),
                0, 10, Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<TaskItemSearchRow>([], 0));
        _searchRepository.SearchProjectsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchEpicsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchLabelsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchCommentsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<CommentSearchRow>([], 0));
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "  login  ");

        var result = await handler.Handle(query, CancellationToken.None);

        await _searchRepository.Received(1).SearchTasksAsync(
            _workspaceId, "login", Arg.Any<TaskItemSearchFilters>(), 0, 10, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldPassParsedFilters_ToTaskRepository()
    {
        _searchRepository.SearchTasksAsync(
                _workspaceId,
                "login",
                Arg.Any<TaskItemSearchFilters>(),
                0, 10, Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<TaskItemSearchRow>([], 0));
        _searchRepository.SearchProjectsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchEpicsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchLabelsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);
        _searchRepository.SearchCommentsAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new PagedSearchItems<CommentSearchRow>([], 0));
        _workspaceRepository.GetMembersAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new SearchQueryHandler(_searchRepository, _workspaceRepository);
        var query = new SearchQuery(_workspaceId, "login", Status: "inreview", Priority: "high");

        await handler.Handle(query, CancellationToken.None);

        await _searchRepository.Received(1).SearchTasksAsync(
            _workspaceId,
            "login",
            Arg.Is<TaskItemSearchFilters>(f => f.Status == TaskItemStatus.InReview && f.Priority == TaskItemPriority.High),
            0, 10,
            Arg.Any<CancellationToken>());
    }
}
