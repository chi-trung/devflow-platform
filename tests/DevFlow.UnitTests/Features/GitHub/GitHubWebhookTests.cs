using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.GitHub;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.GitHub;

public class GitHubWebhookSignatureTests
{
    [Fact]
    public void ComputeSha256_ShouldReturnExpectedSignature()
    {
        const string secret = "mysecret";
        const string body = "{\"event\":\"test\"}";

        var result = GitHubWebhookSignature.ComputeSha256(secret, body);

        Assert.StartsWith("sha256=", result);
        Assert.Equal(7 + 64, result.Length);
    }

    [Fact]
    public void Verify_ShouldPass_ForValidSignature()
    {
        const string secret = "mysecret";
        const string body = "{\"event\":\"test\"}";
        var signature = GitHubWebhookSignature.ComputeSha256(secret, body);

        Assert.True(GitHubWebhookSignature.Verify(secret, body, signature));
    }

    [Fact]
    public void Verify_ShouldFail_ForBadSignature()
    {
        Assert.False(GitHubWebhookSignature.Verify("mysecret", "body", "sha256=invalid"));
        Assert.False(GitHubWebhookSignature.Verify("secret-a", "body", GitHubWebhookSignature.ComputeSha256("secret-b", "body")));
    }
}

public class TaskKeyParserTests
{
    [Fact]
    public void ParseKeys_ShouldExtractMatchingProjectKeys()
    {
        var keys = TaskKeyParser.ParseKeys("Fix DF-104 and DF-105 in this PR", "DF");

        Assert.Equal(new[] { "DF-104", "DF-105" }, keys);
    }

    [Fact]
    public void ParseKeys_ShouldIgnoreOtherProjectKeys()
    {
        var keys = TaskKeyParser.ParseKeys("Fix DF-104 referencing JIRA-9", "DF");

        Assert.Equal(new[] { "DF-104" }, keys);
    }

    [Fact]
    public void ParseKeys_ShouldBeCaseInsensitive()
    {
        var keys = TaskKeyParser.ParseKeys("Fix df-104", "DF");

        Assert.Equal(new[] { "DF-104" }, keys);
    }

    [Fact]
    public void ParseKeys_ShouldDeduplicate()
    {
        var keys = TaskKeyParser.ParseKeys("df-104 and DF-104", "DF");

        Assert.Equal(new[] { "DF-104" }, keys);
    }

    [Fact]
    public void ParseKeys_ShouldReturnEmpty_ForNullOrBlank()
    {
        Assert.Empty(TaskKeyParser.ParseKeys(null, "DF"));
        Assert.Empty(TaskKeyParser.ParseKeys("   ", "DF"));
    }
}

public class GitHubWebhookHandlerTests
{
    private readonly IGitHubRepository _gitHubRepository = Substitute.For<IGitHubRepository>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly GitHubIntegration _integration;
    private readonly TaskItem _task;

    public GitHubWebhookHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _integration = GitHubIntegration.Create(_project.Id, "https://github.com/acme/devflow", null);
        _task = TaskItem.Create(_project.Id, "DEV-101: Fix CORS", null, TaskItemPriority.Medium);

        _gitHubRepository.GetByRepositoryUrlAsync("https://github.com/acme/devflow", Arg.Any<CancellationToken>())
            .Returns(_integration);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { _task });
    }

    private GitHubWebhookPayload PrPayload(string action, bool merged, string state) =>
        new(
            Event: "pull_request",
            Action: action,
            RepositoryUrl: "https://github.com/acme/devflow",
            SenderLogin: "bob",
            SenderName: "Bob",
            PrTitle: "DEV-101: Fix CORS",
            PrBody: "Fixes DEV-101",
            PrUrl: "https://github.com/acme/devflow/pull/1",
            PrState: state,
            PrMerged: merged,
            IssueTitle: null,
            IssueBody: null,
            IssueUrl: null,
            IssueState: null,
            CommitMessage: null,
            Ref: null,
            ProjectId: _project.Id);

    [Fact]
    public async Task ProcessAsync_PrOpened_ShouldMoveTaskToInReview()
    {
        await GitHubWebhookHandler.ProcessAsync(
            PrPayload("opened", merged: false, state: "open"),
            _gitHubRepository, _activityLogRepository, _taskItemRepository, _projectRepository, _unitOfWork,
            CancellationToken.None);

        Assert.Equal(TaskItemStatus.InReview, _task.Status);
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Action.Contains("PR open", StringComparison.OrdinalIgnoreCase)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrMerged_ShouldMoveTaskToDone()
    {
        await GitHubWebhookHandler.ProcessAsync(
            PrPayload("closed", merged: true, state: "closed"),
            _gitHubRepository, _activityLogRepository, _taskItemRepository, _projectRepository, _unitOfWork,
            CancellationToken.None);

        Assert.Equal(TaskItemStatus.Done, _task.Status);
    }

    [Fact]
    public async Task ProcessAsync_NoMatchingTask_ShouldNotChangeAnything()
    {
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<TaskItem>());

        await GitHubWebhookHandler.ProcessAsync(
            PrPayload("opened", merged: false, state: "open"),
            _gitHubRepository, _activityLogRepository, _taskItemRepository, _projectRepository, _unitOfWork,
            CancellationToken.None);

        await _activityLogRepository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
