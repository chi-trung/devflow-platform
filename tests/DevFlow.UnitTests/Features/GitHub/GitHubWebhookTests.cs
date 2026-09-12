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
    public void ParseKeys_ShouldMatchProjectKeyContainingDigits()
    {
        // Project keys may embed digits ("SPB2") — the parser must still find
        // "SPB2-1"; a letters-only generic regex used to miss every such key.
        var keys = TaskKeyParser.ParseKeys("Closes SPB2-1 and spb2-22", "SPB2");

        Assert.Equal(new[] { "SPB2-1", "SPB2-22" }, keys);
    }

    [Fact]
    public void ParseKeys_ShouldNotMatchDigitKeyAsLetterPrefix()
    {
        // Key "SP" must not swallow "SPB2-1" (letters-only keys stay exact).
        Assert.Empty(TaskKeyParser.ParseKeys("SPB2-1", "SP"));
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
    private readonly IRealtimeNotifier _realtimeNotifier = Substitute.For<IRealtimeNotifier>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly GitHubIntegration _integration;
    private readonly TaskItem _task;

    public GitHubWebhookHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _integration = GitHubIntegration.Create(_project.Id, "https://github.com/acme/devflow", null);
        _task = TaskItem.Create(_project.Id, "DEV-101: Fix CORS", null, TaskItemPriority.Medium);
        _task.SetNumber(1);

        _gitHubRepository.GetByRepositoryUrlAsync("https://github.com/acme/devflow", Arg.Any<CancellationToken>())
            .Returns(_integration);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { _task });
        // The handler re-loads tasks by id for status transitions (the match
        // query is AsNoTracking in production) — return the same instance.
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(_task);
    }

    private GitHubWebhookPayload PrPayload(string action, bool merged, string state, IReadOnlyList<string>? commitMessages = null) =>
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
            CommitMessages: commitMessages ?? Array.Empty<string>(),
            Ref: null,
            ProjectId: _project.Id);

    private Task ProcessAsync(GitHubWebhookPayload payload) =>
        GitHubWebhookHandler.ProcessAsync(
            payload,
            _gitHubRepository, _activityLogRepository, _taskItemRepository, _projectRepository, _unitOfWork,
            _realtimeNotifier, _cacheService,
            CancellationToken.None);

    [Fact]
    public async Task ProcessAsync_PrOpened_ShouldMoveTaskToInReview()
    {
        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        Assert.Equal(TaskItemStatus.Review, _task.Status);
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Action.Contains("PR open", StringComparison.OrdinalIgnoreCase)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrMerged_ShouldMoveTaskToDone()
    {
        await ProcessAsync(PrPayload("closed", merged: true, state: "closed"));

        Assert.Equal(TaskItemStatus.Done, _task.Status);
    }

    [Fact]
    public async Task ProcessAsync_NoMatchingTask_ShouldNotChangeAnything()
    {
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<TaskItem>());

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _activityLogRepository.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrOpened_ShouldCreateLinkedPullRequestRow()
    {
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PullRequest>());

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _gitHubRepository.Received(1).AddPullRequestAsync(
            Arg.Is<PullRequest>(pr =>
                pr.Url == "https://github.com/acme/devflow/pull/1" &&
                pr.Status == "Open" &&
                pr.LinkedTaskId == _task.Id &&
                pr.Author == "bob"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrRedelivery_ShouldNotDuplicatePullRequestRow()
    {
        var existing = PullRequest.Create(
            _project.Id, "DEV-101: Fix CORS", "https://github.com/acme/devflow/pull/1", "Open", "bob");
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { existing });

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _gitHubRepository.DidNotReceive().AddPullRequestAsync(Arg.Any<PullRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrMerged_ShouldUpdateExistingRowStatus()
    {
        var existing = PullRequest.Create(
            _project.Id, "DEV-101: Fix CORS", "https://github.com/acme/devflow/pull/1", "Open", "bob");
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { existing });

        await ProcessAsync(PrPayload("closed", merged: true, state: "closed"));

        Assert.Equal("Merged", existing.Status);
    }

    [Fact]
    public async Task ProcessAsync_KeyInSecondCommit_ShouldMatchTaskByNumber()
    {
        _task.SetNumber(101);
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PullRequest>());

        var payload = new GitHubWebhookPayload(
            Event: "push",
            Action: null,
            RepositoryUrl: "https://github.com/acme/devflow",
            SenderLogin: "bob",
            SenderName: "Bob",
            PrTitle: null,
            PrBody: null,
            PrUrl: null,
            PrState: null,
            PrMerged: false,
            IssueTitle: null,
            IssueBody: null,
            IssueUrl: null,
            IssueState: null,
            CommitMessages: new[] { "chore: bump deps", "DEV-101: fix the thing" },
            Ref: "refs/heads/main",
            ProjectId: _project.Id);

        await ProcessAsync(payload);

        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Action.Contains("push", StringComparison.OrdinalIgnoreCase)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_IssueEvent_ShouldNotCreatePullRequestRow()
    {
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PullRequest>());

        var payload = new GitHubWebhookPayload(
            Event: "issues",
            Action: "opened",
            RepositoryUrl: "https://github.com/acme/devflow",
            SenderLogin: "bob",
            SenderName: "Bob",
            PrTitle: null,
            PrBody: null,
            PrUrl: null,
            PrState: null,
            PrMerged: false,
            IssueTitle: "Bug in DEV-101",
            IssueBody: null,
            IssueUrl: "https://github.com/acme/devflow/issues/9",
            IssueState: "open",
            CommitMessages: Array.Empty<string>(),
            Ref: null,
            ProjectId: _project.Id);

        await ProcessAsync(payload);

        await _gitHubRepository.DidNotReceive().AddPullRequestAsync(Arg.Any<PullRequest>(), Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_ChangesApplied_ShouldNotifyProject()
    {
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PullRequest>());

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _realtimeNotifier.Received(1).NotifyProjectAsync(
            _project.Id, "GitHubWebhook", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_ChangesApplied_ShouldInvalidateTasksCache()
    {
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<PullRequest>());

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _cacheService.Received(1).RemoveByTagAsync($"project:{_project.Id}", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_VariantRepositoryUrl_ShouldLookUpCanonicalKey()
    {
        // Integrations linked before store-side canonicalization carried raw
        // pasted variants; the handler must query the canonical key GitHub's
        // html_url maps to, or the delivery silently drops with no match.
        var payload = PrPayload("opened", merged: false, state: "open");
        await GitHubWebhookHandler.ProcessAsync(
            payload with { RepositoryUrl = "https://www.GitHub.com/Acme/DevFlow.git" },
            _gitHubRepository, _activityLogRepository, _taskItemRepository, _projectRepository,
            _unitOfWork, _realtimeNotifier, _cacheService, CancellationToken.None);

        await _gitHubRepository.Received(1).GetByRepositoryUrlAsync(
            "https://github.com/acme/devflow", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ProcessAsync_PrRedeliveryAgainstVariantStoredUrl_ShouldNotDuplicateRow()
    {
        // The manual add-PR form stored the URL exactly as pasted — a
        // trailing slash or casing difference used to re-create the row on
        // every webhook redelivery instead of updating the existing one.
        var existing = PullRequest.Create(
            _project.Id, "DEV-101: Fix CORS", "https://github.com/Acme/DevFlow/pull/1/", "Open", "bob");
        _gitHubRepository.GetPullRequestsByProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { existing });

        await ProcessAsync(PrPayload("closed", merged: true, state: "closed"));

        await _gitHubRepository.DidNotReceive().AddPullRequestAsync(Arg.Any<PullRequest>(), Arg.Any<CancellationToken>());
        Assert.Equal("Merged", existing.Status);
    }

    [Fact]
    public async Task ProcessAsync_NoMatchingTask_ShouldNotInvalidateCache()
    {
        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<TaskItem>());

        await ProcessAsync(PrPayload("opened", merged: false, state: "open"));

        await _cacheService.DidNotReceive().RemoveByTagAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
